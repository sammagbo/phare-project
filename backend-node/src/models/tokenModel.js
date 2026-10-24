const db = require('../db/database');

const run = async (sql, params) => {
    await db.ready;
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) reject(err);
            else resolve(this.changes);
        });
    });
};

// The refresh tokens, by their SHA-256 only (see the table in db/database.js). Dates are ISO strings.
const TokenModel = {
    create: ({ tokenHash, familyId, userId, expiresAt }) => run(
        'INSERT INTO refresh_tokens (token_hash, family_id, user_id, expires_at) VALUES (?, ?, ?, ?)',
        [tokenHash, familyId, userId, expiresAt.toISOString()],
    ),

    findByHash: async (tokenHash) => {
        await db.ready;
        return new Promise((resolve, reject) => {
            db.get('SELECT * FROM refresh_tokens WHERE token_hash = ?', [tokenHash], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    },

    /** Marks a live token as replaced; false when another request replaced it first. */
    markReplaced: async (id, when) => (await run(
        'UPDATE refresh_tokens SET replaced_at = ? WHERE id = ? AND replaced_at IS NULL',
        [when.toISOString(), id],
    )) === 1,

    /** Takes the one use of the grace interval; false when it was already taken. */
    useGrace: async (id, when) => (await run(
        'UPDATE refresh_tokens SET grace_used_at = ? WHERE id = ? AND grace_used_at IS NULL',
        [when.toISOString(), id],
    )) === 1,

    /** Revokes a session: every token of the family goes. */
    deleteFamily: (familyId) => run('DELETE FROM refresh_tokens WHERE family_id = ?', [familyId]),

    deleteExpired: (when) => run('DELETE FROM refresh_tokens WHERE expires_at <= ?', [when.toISOString()]),
};

module.exports = TokenModel;
