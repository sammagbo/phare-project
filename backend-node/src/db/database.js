const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// The SQLite file comes from PHARE_DB_PATH; by default it stays backend-node/database.sqlite
const dbPath = process.env.PHARE_DB_PATH
    ? path.resolve(process.env.PHARE_DB_PATH)
    : path.resolve(__dirname, '../../database.sqlite');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error connecting to SQLite database:', err.message);
    }
});

const run = (sql) => new Promise((resolve, reject) => {
    db.run(sql, (err) => (err ? reject(err) : resolve()));
});
const all = (sql) => new Promise((resolve, reject) => {
    db.all(sql, (err, rows) => (err ? reject(err) : resolve(rows)));
});

// The schema, created before any query runs (the models wait for it): the server and the account script
// (scripts/create-user.js) also work on a brand-new database, without the tables yet.
db.ready = (async () => {
    await run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // The first version of refresh_tokens kept each token in clear, in a `token` column. That table is dropped and
    // replaced: the sessions it held end, and everyone signs in again once.
    const columns = (await all('PRAGMA table_info(refresh_tokens)')).map((column) => column.name);
    if (columns.includes('token')) {
        await run('DROP TABLE refresh_tokens');
    }

    // One row per refresh token ever issued, kept until it expires: only the SHA-256 of the token, never the token.
    // A login starts a family; each refresh replaces the family's live token (replaced_at), and a replaced token that
    // comes back revokes the family. grace_used_at marks the one use allowed in the 30 s after the replacement.
    await run(`
        CREATE TABLE IF NOT EXISTS refresh_tokens (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            token_hash TEXT UNIQUE NOT NULL,
            family_id TEXT NOT NULL,
            user_id INTEGER NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            expires_at DATETIME NOT NULL,
            replaced_at DATETIME,
            grace_used_at DATETIME,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);
    await run('CREATE INDEX IF NOT EXISTS refresh_tokens_family ON refresh_tokens (family_id)');
})();

module.exports = db;
