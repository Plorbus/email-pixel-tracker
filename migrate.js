const fs = require('fs');
const {openDb} = require('./db');

const SOURCE = 'data.json';
const TARGET = 'tracker.db';

const emails = JSON.parse(fs.readFileSync(SOURCE, 'utf8'));
const ids = Object.keys(emails);
const expectedOpens = ids.reduce((n,id) => n + (emails[id].opens ?? []).length,0);

console.log(`source: ${ids.length} emails, ${expectedOpens.length} opens`);

const db = openDb(TARGET);

const existing = db.prepare('SELECT COUNT(*) as n FROM emails').get().n;
if (existing) {
    console.error(`refusing to migrate ${TARGET} already has ${existing} emails`);
    console.error('delete tracker.db, tracer.db-wal and tracker.db-shm to redo this');
    process.exit(1);
}

const insertEmail = db.prepare(
    `INSERT INTO emails (id, to_address,created_at) VALUES (?,?,?)`
);
const insetOpen = db.prepare(`INSERT INTO opens (email_id, opened_at, ip, user_agent, vector) VALUES (?,?,?,?,?)`
);

const importAll = db.transaction((source) => {
    for (const [id, email] of Object.entries(source)) {
        insertEmail.run(id, email.to, email.createdAt);

        for const 
    }
})