const Database = require('better-sqlite3');

const MIGRATIONS = [
    `
    CREATE TABLE emails(
        id TEXT PRIMARY KEY,
        to_address TEXT NOT NULL,
        created_at TEXT NOT NULL
    );

    CREATE TABLE opens(
        id INTEGER PRIMARY KEY,
        email_id TEXT NOT NULL REFERENCES emails(id) on DELETE CASCADE,
        opened_at TEXT NOT NULL,
        ip TEXT,
        user_agent TEXT,
        vector TEXT
    );
    CREATE INDEX idx_opens_email_id ON Opens(email_id);
    `,
];



function migrate(db) {
    const current = db.pragma('user_version',{simple:true});

    const apply = db.transaction((sql, version) =>{
        db.exec(sql);
        db.pragma(`user_version = ${version}`);
    });

    for(let v = current; v < MIGRATIONS.length; v++){
        apply(MIGRATIONS[v], v+1);
        console.log(`db: migrated to schema version ${v+1}`);
    }
}

function openDb(path){
    const db = new Database(path);
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    migrate(db);
    return db;
}

function createDb(path){
    const db = openDb(path);

    const insertEmail = db.prepare(
        `INSERT INTO emails (id, to_address, created_at) VALUES (? ,? ,?)`
    );
    const insertOpen = db.prepare(
        `INSERT INTO opens (email_id, opened_at, ip, user_agent, vector) VALUES (? ,? ,? ,? ,?)`
    );
    const selectEmail = db.prepare(`SELECT * FROM emails WHERE id = ?`);
    const selectList = db.prepare(`SELECT e.id, e.to_address, e.created_at, COUNT(o.id) AS open_count,
        MAX (o.opened_at) AS last_opened FROM emails e
        LEFT JOIN opens o ON o.email_id = e.id
        GROUP BY e.id
        ORDER BY last_opened DESC
        `);
    function createEmail(id,to){
        const createdAt = new Date().toISOString();
        insertEmail.run(id, to, createdAt);
        return { id , to_address: to, created_at: createdAt };
    }
    function recordOpen(emailId,open){
        const email = selectEmail.get(emailId);
        if (!email) return null;

        insertOpen.run(
            emailId,
            open.openedAt,
            open.ip ?? null,
            open.userAgent ?? null,
            open.vector ?? null,
        );
        return email;
    }
    function listEmails(){
        return selectList.all()
    }


    return {createEmail, recordOpen, listEmails};
}



module.exports = {openDb, createDb, migrate};

