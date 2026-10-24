const crypto = require('crypto');

// The refresh token travels only in this cookie: HttpOnly (no script reads it), SameSite=Strict (no other site sends
// it), limited to /api/auth, for 7 days. `Secure` only when the request came over HTTPS: over plain http, on localhost
// and on the local network, the browser would refuse a Secure cookie and nobody could stay signed in.
const COOKIE_NAME = 'phare_refresh';
const COOKIE_PATH = '/api/auth';
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

const options = (req, maxAge) => ({
    httpOnly: true,
    sameSite: 'strict',
    path: COOKIE_PATH,
    secure: req.secure,
    maxAge,
});

/** A new opaque refresh token: 32 random bytes, base64url. */
const newRefreshToken = () => crypto.randomBytes(32).toString('base64url');

/** What the database keeps instead of the token: its SHA-256, hex. */
const hashToken = (token) => crypto.createHash('sha256').update(token, 'utf8').digest('hex');

/** The refresh token of the request's cookie, or null. */
const readRefreshCookie = (req) => {
    const header = req.headers.cookie;
    if (!header) return null;
    for (const part of header.split(';')) {
        const eq = part.indexOf('=');
        if (eq > 0 && part.slice(0, eq).trim() === COOKIE_NAME) {
            const value = part.slice(eq + 1).trim();
            return value || null;
        }
    }
    return null;
};

const setRefreshCookie = (req, res, token) => res.cookie(COOKIE_NAME, token, options(req, TTL_MS));

/** Deletes the cookie in the browser: an empty value, Max-Age=0, the same Path. */
const clearRefreshCookie = (req, res) => res.cookie(COOKIE_NAME, '', options(req, 0));

module.exports = {
    COOKIE_NAME, COOKIE_PATH, TTL_MS, newRefreshToken, hashToken, readRefreshCookie, setRefreshCookie, clearRefreshCookie,
};
