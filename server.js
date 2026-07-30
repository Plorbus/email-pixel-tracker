const express = require('express');
const app = express();
app.use(express.urlencoded({ extended: false }));
const PORT = 3000;
const PIXEL = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
const crypto = require('crypto');
const fs = require('fs');
const DATA_FILE = 'data.json';
const emails = loadData();
const AUTH_USER = process.env.ADMIN_USER;
const AUTH_PASS = process.env.ADMIN_PASS;


function escapeHtml(str){
    return String(str)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}
function rowsHtml(){
    return Object.entries(emails).map(([id,email])=>{
        const opens= email.opens || [];
        const last = opens.length ? opens[opens.length -1].openedAt : '-';
        return `<tr> 
            <td>${escapeHtml(email.to)}</td>
            <td><code>${escapeHtml(id)}</code></td>
            <td>${opens.length}</td>
            <td>${escapeHtml(last)}</td>
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
            <input name="to" type="email" placeholder="recipient@example.com" required>
            <button type="submit">Send</button>
        </form>
        <h2>Tracked Emails</h2>
        <table border="1" cellpadding="6">
            <tr><th>Recipient</th><th>Tracking ID</th><th>Opens</th><th>Last Open</th></tr>
            ${rowsHtml()}
        </table>
    `);
});
function saveData(){
    const tmp = DATA_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(emails, null, 2));
    fs.renameSync(tmp,DATA_FILE)
}

function safeEqual(a,b){
    const ah = crypto.createHash('sha256').update(String(a)).digest();
    const bh = crypto.createHash('sha256').update(String(b)).digest();
    return crypto.timingSafeEqual(ah,bh)
}

function loadData() {
    if (fs.existsSync(DATA_FILE)) {
        return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    }
    return {};
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

// app.get('/new', (req,res) =>{
//     const to = req.query.to;
//     const id = crypto.randomUUID();
//     emails[id] = {to, createdAt: now(), opens:[] };
//
//     const PixelUrl = `${req.protocol}://${req.get('host')}/pixel/${id}`;
//     res.type('text/plain');
//     res.send(`<img src="${PixelUrl}" width="1" height="1" alt="">`);
//     saveData();
// });

app.get('/results', requireAuth, (req,res) =>{
    res.json(emails);
});

app.get('/pixel/:id', (req,res) =>{
    const id = req.params.id;
    const open = {
        openedAt: now(),
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        vector: req.query.v || 'img',
    };

    if (Object.hasOwn(emails,id)){
        const email = emails[id];
        email.opens.push(open);
        console.log(`Open id=${id} to=${email.to} (${email.opens.length} total)`);
    } else {
        console.log(`Open for UNKNOWN id=${id} not in registry`);
    }

    res.set('Content-Type', 'image/gif');
    res.send(PIXEL);
    saveData();
});




//
// app.get('/dashboard', requireAuth, (req, res) => {
//     let html = `
//     <h1>Tracking Dashboard</h1>
//     <table border="1" cellpadding="6">
//       <tr><th>Recipient</th><th>Tracking ID</th><th>Opens</th></tr>
//   `;
//
//     for (const [id, email] of Object.entries(emails)) {
//         const recipient = email.to || '(no recipient)';
//         const openCount = email.opens.length;
//         html += `<tr><td>${recipient}</td><td>${id}</td><td>${openCount}</td></tr>`;
//     }
//
//     html += `</table>`;
//
//     res.send(html);
// });


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

// app.get('/send', async (req, res) => {
//     const to = req.query.to;
//     if (!to) return res.status(400).send(' ?to=email');
//
//     const id = crypto.randomUUID();          // mint a unique id for this send
//     emails[id] = { to, createdAt: now(), opens: [] };
//     saveData();
//
//     const pixel = `<img src="${PUBLIC_URL}/pixel/${id}?v=email" width="1" height="1" alt="">`;
//
//     try {
//         await transporter.sendMail({
//             from: process.env.GMAIL_USER,
//             to,
//             subject: 'Testing my tracker',
//             html: `<p>Hey! Thanks for reading.</p>${pixel}`,   // HTML body carries the pixel
//         });
//         res.send(`Sent to ${to} (tracking id ${id})`);
//     } catch (err) {
//         console.error(err);
//         res.status(500).send('send failed: ' + err.message);
//     }
// });


app.post('/admin/send',requireAuth, async (req,res) =>{
    const to = req.body.to;
    if (!to) return res.status(400).send(' ?to=email');

    const id = crypto.randomUUID();          // mint a unique id for this send
    emails[id] = { to, createdAt: now(), opens: [] };
    saveData();

    const pixel = `<img src="${PUBLIC_URL}/pixel/${id}?v=email" width="1" height="1" alt="">`;

    try {
        await transporter.sendMail({
            from: process.env.GMAIL_USER,
            to,
            subject: 'Testing my tracker',
            html: `<p>Hey! Thanks for reading.</p>${pixel}`,   // HTML body carries the pixel
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
