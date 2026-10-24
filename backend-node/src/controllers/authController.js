const bcrypt = require('bcrypt');
const crypto = require('crypto');
const UserModel = require('../models/userModel');
const TokenModel = require('../models/tokenModel');
const { signAccessToken } = require('../token');
const {
    TTL_MS, newRefreshToken, hashToken, readRefreshCookie, setRefreshCookie, clearRefreshCookie,
} = require('../refreshCookie');

// After a refresh replaces a token, the old one still works once in this interval, for an access token only and with no
// new cookie: two tabs share the cookie, and when they renew at the same time one of them sends the token the other has
// just replaced.
const GRACE_MS = 30 * 1000;

/** A new token for the family, saved as a hash, and set in the cookie. */
const issueRefreshToken = async (req, res, { familyId, userId, now }) => {
    const token = newRefreshToken();
    await TokenModel.create({
        tokenHash: hashToken(token), familyId, userId, expiresAt: new Date(now.getTime() + TTL_MS),
    });
    setRefreshCookie(req, res, token);
};

const refused = (req, res, error) => {
    clearRefreshCookie(req, res);
    return res.status(401).json({ error });
};

// There is no sign-up: accounts are created by the administrator, from the server's terminal (scripts/create-user.js).
const AuthController = {
    login: async (req, res) => {
        try {
            const { email, password } = req.body;

            const user = await UserModel.findByEmail(email);
            if (!user) {
                // Return generic message for security to obscure whether the email exists
                return res.status(401).json({ error: 'Invalid credentials' });
            }

            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }

            // A new session: a new family, its first refresh token in the cookie, and the access token of the contract
            const now = new Date();
            await TokenModel.deleteExpired(now);
            await issueRefreshToken(req, res, { familyId: crypto.randomUUID(), userId: user.id, now });

            return res.status(200).json({
                token: signAccessToken(user),
                user: { id: user.id, email: user.email },
            });
        } catch (err) {
            console.error('Login error:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
    },

    refresh: async (req, res) => {
        try {
            const presented = readRefreshCookie(req);
            if (!presented) {
                return res.status(401).json({ error: 'No session' });
            }

            const now = new Date();
            let record = await TokenModel.findByHash(hashToken(presented));
            if (!record) {
                return refused(req, res, 'Invalid session');
            }
            if (new Date(record.expires_at) <= now) {
                await TokenModel.deleteFamily(record.family_id);
                return refused(req, res, 'Session expired. Please log in again.');
            }

            // The live token of the family: it is replaced by a new one. If a parallel request replaced it first, this
            // one is treated as a token that was just replaced.
            if (!record.replaced_at && !(await TokenModel.markReplaced(record.id, now))) {
                record = await TokenModel.findByHash(record.token_hash);
                if (!record) return refused(req, res, 'Invalid session');
            }

            if (record.replaced_at) {
                const age = now.getTime() - Date.parse(record.replaced_at);
                if (age <= GRACE_MS && (await TokenModel.useGrace(record.id, now))) {
                    const user = await UserModel.findById(record.user_id);
                    if (!user) return refused(req, res, 'Invalid session');
                    return res.status(200).json({ token: signAccessToken(user) });
                }
                // A replaced token that comes back: it may have been stolen, so the whole session ends. The log names
                // the user, never the token.
                console.warn(`Refresh token reuse for user ${record.user_id}: the session is revoked.`);
                await TokenModel.deleteFamily(record.family_id);
                return refused(req, res, 'Invalid session');
            }

            const user = await UserModel.findById(record.user_id);
            if (!user) {
                await TokenModel.deleteFamily(record.family_id);
                return refused(req, res, 'Invalid session');
            }
            await issueRefreshToken(req, res, { familyId: record.family_id, userId: user.id, now });
            return res.status(200).json({ token: signAccessToken(user) });
        } catch (err) {
            console.error('Refresh token error:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
    },

    // No access token needed: the cookie names the session. The family is revoked and the cookie deleted; without a
    // cookie, or with an unknown one, the answer is the same 204.
    logout: async (req, res) => {
        try {
            const presented = readRefreshCookie(req);
            if (presented) {
                const record = await TokenModel.findByHash(hashToken(presented));
                if (record) await TokenModel.deleteFamily(record.family_id);
            }
            clearRefreshCookie(req, res);
            return res.status(204).end();
        } catch (err) {
            console.error('Logout error:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
    },

    getMe: async (req, res) => {
        try {
            const userId = Number(req.user.sub);
            const user = await UserModel.findById(userId);
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }
            return res.status(200).json({ user });
        } catch (err) {
            console.error('getMe error:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
    },
};

module.exports = AuthController;
