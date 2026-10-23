const db = require('../db/database');

const UserModel = {
    findByEmail: async (email) => {
        await db.ready;
        return new Promise((resolve, reject) => {
            db.get(`SELECT * FROM users WHERE email = ?`, [email], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });
    },

    findById: async (id) => {
        await db.ready;
        return new Promise((resolve, reject) => {
            db.get(`SELECT id, email, created_at FROM users WHERE id = ?`, [id], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });
    },

    create: async (email, hashedPassword) => {
        await db.ready;
        return new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO users (email, password) VALUES (?, ?)`,
                [email, hashedPassword],
                function (err) {
                    if (err) reject(err);
                    else resolve(this.lastID); // Returns the ID of the newly inserted row
                }
            );
        });
    }
};

module.exports = UserModel;
