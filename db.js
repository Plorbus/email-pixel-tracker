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

module.exports = {openDb, migrate};

