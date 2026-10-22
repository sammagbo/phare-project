const { verifyAccessToken } = require('../token');

const requireAuth = (req, res, next) => {
    // Look for the Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
    }

    const token = authHeader.split(' ')[1];

    try {
        // Verify token: the signature (HS256 only), the expiry, the issuer and the audience of the contract
        const decoded = verifyAccessToken(token);
        
        // Attach user info to the request for the controller to use
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(403).json({ error: 'Forbidden: Invalid or expired token' });
    }
};

module.exports = { requireAuth };
