const db = require('../db/database');

const UserModel = {
    findByEmail: (email) => {
        return new Promise((resolve, reject) => {
            db.get(`SELECT * FROM users WHERE email = ?`, [email], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });
    },

    findById: (id) => {
        return new Promise((resolve, reject) => {
            db.get(`SELECT id, email, created_at FROM users WHERE id = ?`, [id], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });
    },

    create: (email, hashedPassword) => {
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
