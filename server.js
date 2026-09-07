const express = require('express');
const app = express();
app.use(express.urlencoded({ extended: false }));
const PORT = 3000;
const PIXEL = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
const crypto = require('crypto');
const {createDb} = require('./db');
const db = createDb('tracker.db');
const AUTH_USER = process.env.ADMIN_USER;
const AUTH_PASS = process.env.ADMIN_PASS;


function escapeHtml(str){
    return String(str)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

//plausible checker for emails (lazy)
function isPlausibleEmail(value){
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function rowsHtml(){
    return db.listEmails().map((row) => {
        return `<tr>
            <td>${escapeHtml(row.to_address)}</td>
            <td><code>${escapeHtml(row.id)}</code></td>
            <td>${row.open_count}</td>
            <td>${escapeHtml(row.last_opened ?? '-')}</td>
        </tr>`;
    }).join('');
}

app.get('/admin',requireAuth, (req,res) =>{
    let banner = '';

    if (req.query.sent) banner = `<p style="color:green"> ✓ Sent to ${escapeHtml(req.query.sent)}</p>`;
    if (req.query.error) banner = `<p style="color:red"> ✗ Failed ${escapeHtml(req.query.error)}</p>`;
    res.send(`
        <h1> send a tracked email</h1>
            ${banner}
        <form method="POST" action="/admin/send">
            <input name="to" type="email" placeholder="test@example.com" required>
            <input name="subject" type="text" placeholder="Email subject" required>
            <textarea name="message" placeholder="Your message (HTML allowed)" rows="12" cols="80" style="resize: none" required></textarea>
            <button type="submit">Send</button>
        </form>
        <h2>Tracked Emails</h2>
        <table border="1" cellpadding="6">
            <tr><th>Recipient</th><th>Tracking ID</th><th>Opens</th><th>Last Open</th></tr>
            ${rowsHtml()}
        </table>
    `);
});


//hardening of security to prevent guesses via the first letter failing and decoding password
function safeEqual(a,b){
    const ah = crypto.createHash('sha256').update(String(a)).digest();
    const bh = crypto.createHash('sha256').update(String(b)).digest();
    return crypto.timingSafeEqual(ah,bh)
}



function now(){
    return new Date().toISOString();
}
function requireAuth(req,res,next){
    const header = req.get('authorization');

    if (header && header.startsWith('Basic ')) {
        const decoded = Buffer.from(header.slice(6), 'base64').toString();
        const sep = decoded.indexOf(':');
        const user = decoded.slice(0,sep);
        const pass = decoded.slice (sep+1);
        //const [user,pass] = decoded.split(':');
        if (safeEqual(user,AUTH_USER) && safeEqual(pass,AUTH_PASS)) {
            return next();
        }
    }
    res.set('WWW-Authenticate', 'Basic realm="tracker"');
    res.status(401).send('Authenticate failed.');
}



app.get('/results', requireAuth, (req,res) =>{
    res.json(db.listEmails());
});

app.get('/pixel/:id', (req,res) =>{
    const id = req.params.id;
    const open = {
        openedAt: now(),
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        vector: req.query.v || 'img',
    };

    res.set('Content-Type', 'image/gif');
    res.send(PIXEL);

    try {
        const email = db.recordOpen(id, open);
        if (email) {
            console.log(`Open id=${id} to=${email.to_address}`);
        } else {
            console.log(`Open for UNKNOWN id=${id} not in registry`);
        }
    } catch (err) {
        console.error(`failed to record open for id=${id}:`, err.message);
    }
});






const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASS,
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
});

const PUBLIC_URL = process.env.PUBLIC_URL || 'http://localhost:3000';



app.post('/admin/send',requireAuth, async (req,res) =>{
    const to = req.body.to;
    const subject = req.body.subject;
    const message = req.body.message;
    if (!isPlausibleEmail(to)){
        return res.redirect('/admin?error=' + encodeURIComponent('invalid recipient address'));
    }

    const id = crypto.randomUUID();          // creates a unique id for every send
    db.createEmail(id,to);

    const pixel = `<img src="${PUBLIC_URL}/pixel/${id}?v=email" width="1" height="1" alt="">`;

    try {
        await transporter.sendMail({
            from: process.env.GMAIL_USER,
            to,
            subject: subject,
            html: `${message}${pixel}`,   // user's HTML body and the tracking pixel
        });
        res.redirect('/admin?sent=' + encodeURIComponent(to));
    } catch (err) {
        console.error(err);
        res.redirect('/admin?error=' + encodeURIComponent(err.message));
    }
})

app.listen(PORT,() => {
    console.log(`Server listening on http://localhost:${PORT}`);
});
