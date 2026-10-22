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

// The schema, created before any query runs (the models wait for it): the server and the account script
// (scripts/create-user.js) also work on a brand-new database, without the tables yet.
db.ready = new Promise((resolve, reject) => {
    db.serialize(() => {
        db.run(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `, (err) => {
            if (err) reject(err);
        });

        db.run(`
            CREATE TABLE IF NOT EXISTS refresh_tokens (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                token TEXT UNIQUE NOT NULL,
                user_id INTEGER NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                expires_at DATETIME NOT NULL,
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `, (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
});

module.exports = db;
