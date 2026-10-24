const { verifyAccessToken } = require('../token');

// Without a valid access token the answer is 401, with the WWW-Authenticate challenge of RFC 6750 (§3.1): plain
// `Bearer` when no token came, `Bearer error="invalid_token"` when one came but is invalid or expired. The frontend
// renews its token on a 401 only; 403 stays for an authenticated user without the right, a case that does not exist yet.
const requireAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.set('WWW-Authenticate', 'Bearer');
        return res.status(401).json({ error: 'Unauthorized: missing token' });
    }

    const token = authHeader.slice('Bearer '.length).trim();

    try {
        // The signature (HS256 only), the expiry, the issuer and the audience of the contract
        req.user = verifyAccessToken(token);
        next();
    } catch (err) {
        res.set('WWW-Authenticate', 'Bearer error="invalid_token"');
        return res.status(401).json({ error: 'Unauthorized: invalid or expired token' });
    }
};

module.exports = { requireAuth };
