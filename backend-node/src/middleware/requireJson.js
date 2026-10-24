// The routes that act on the session cookie (refresh, logout) only take `Content-Type: application/json`: a form of
// another site can send only form or text types without a preflight, so it cannot reach them. With SameSite=Strict and
// the CORS list, this closes cross-site requests (CSRF). Any other type gets 415.
const requireJson = (req, res, next) => {
    const type = (req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
    if (type !== 'application/json') {
        return res.status(415).json({ error: 'Content-Type must be application/json' });
    }
    next();
};

module.exports = { requireJson };
