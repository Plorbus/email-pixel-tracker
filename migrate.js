const fs = require('fs');
const {openDb} = require('./db');

const SOURCE = 'data.json';
const TARGET = 'tracker.db';


//format data into variables easier to keep track of
const emails = JSON.parse(fs.readFileSync(SOURCE, 'utf8'));
const ids = Object.keys(emails);
const expectedOpens = ids.reduce((n,id) => n + (emails[id].opens ?? []).length,0);

console.log(`source: ${ids.length} emails, ${expectedOpens} opens`);

const db = openDb(TARGET);

const existing = db.prepare('SELECT COUNT(*) as n FROM emails').get().n;
if (existing) {
    console.error(`refusing to migrate ${TARGET} already has ${existing} emails`);
    console.error('delete tracker.db, tracker.db-wal and tracker.db-shm to redo this');
    process.exit(1);
}

const insertEmail = db.prepare(
    `INSERT INTO emails (id, to_address,created_at) VALUES (?,?,?)`
);
const insertOpen = db.prepare   (`INSERT INTO opens (email_id, opened_at, ip, user_agent, vector) VALUES (?,?,?,?,?)`
);

const importAll = db.transaction((source) => {
    for (const [id, email] of Object.entries(source)) {
        insertEmail.run(id, email.to, email.createdAt);

        for (const open of email.opens ?? []) {
            insertOpen.run(
                id,
                open.openedAt,
                open.ip ?? null,
                open.userAgent ?? null,
                open.vector ?? null
            );
        }
    }
});

importAll(emails);
const emailCount = db.prepare('SELECT COUNT(*) as n FROM emails').get().n;
const openCount = db.prepare('SELECT COUNT(*) as n FROM opens').get().n;

console.log(`target: ${emailCount} emails, ${openCount} opens`);

if (emailCount !== ids.length || openCount !== expectedOpens) {
    console.error('Data mismatch do not delete data.json')
    process.exit(1);
}
console.log('counts match');

