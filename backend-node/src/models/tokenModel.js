const db = require('../db/database');

const TokenModel = {
    saveRefreshToken: (token, userId, expiresAt) => {
        return new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO refresh_tokens (token, user_id, expires_at) VALUES (?, ?, ?)`,
                [token, userId, expiresAt.toISOString()],
                function (err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                }
            );
        });
    },

    findRefreshToken: (token) => {
        return new Promise((resolve, reject) => {
            db.get(`SELECT * FROM refresh_tokens WHERE token = ?`, [token], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });
    },

    deleteRefreshToken: (token) => {
        return new Promise((resolve, reject) => {
            db.run(`DELETE FROM refresh_tokens WHERE token = ?`, [token], function (err) {
                if (err) reject(err);
                else resolve(this.changes > 0);
            });
        });
    },

    deleteAllUserTokens: (userId) => {
        return new Promise((resolve, reject) => {
            db.run(`DELETE FROM refresh_tokens WHERE user_id = ?`, [userId], function (err) {
                if (err) reject(err);
                else resolve(this.changes);
            });
        });
    }
};

module.exports = TokenModel;
