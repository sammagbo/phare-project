const jwt = require('jsonwebtoken');

// The contract of the access token, shared with the pHARe API (backend, com.phare.security.SecurityConfig):
// HS256, with the UTF-8 bytes of JWT_SECRET as the key (32 bytes or more, and no fallback anywhere);
// iss = phare-auth, aud = phare-api, sub = the user's id as text, email, iat, and exp = iat + 15 min.
const ISSUER = 'phare-auth';
const AUDIENCE = 'phare-api';
const ALGORITHM = 'HS256';
const TTL = '15m';
const MIN_SECRET_BYTES = 32;

/** The shared secret, or an error when it is missing or shorter than 32 bytes. */
const assertSecret = (secret = process.env.JWT_SECRET) => {
    if (!secret || Buffer.byteLength(secret, 'utf8') < MIN_SECRET_BYTES) {
        throw new Error(`JWT_SECRET is missing or shorter than ${MIN_SECRET_BYTES} bytes: the auth service does not start `
            + 'without the secret it shares with the pHARe API.');
    }
    return secret;
};

/** The access token of a user, signed at login and at refresh. */
const signAccessToken = (user) => jwt.sign({ email: user.email }, assertSecret(), {
    algorithm: ALGORITHM,
    issuer: ISSUER,
    audience: AUDIENCE,
    subject: String(user.id),
    expiresIn: TTL,
});

/** The claims of a valid access token; throws on any other token (signature, algorithm, issuer, audience, expiry). */
const verifyAccessToken = (token) => jwt.verify(token, assertSecret(), {
    algorithms: [ALGORITHM],
    issuer: ISSUER,
    audience: AUDIENCE,
});

module.exports = { ISSUER, AUDIENCE, ALGORITHM, MIN_SECRET_BYTES, assertSecret, signAccessToken, verifyAccessToken };
