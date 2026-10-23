const rateLimit = require('express-rate-limit');

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

// General API rate limiting
const apiLimiter = rateLimit({
    windowMs: WINDOW_MS,
    max: 100, // limit each IP to 100 requests per windowMs
    message: { error: 'Too many requests from this IP, please try again after 15 minutes' },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// The login: 10 failed attempts per IP in 15 minutes, then 429. A login that succeeds does not count, so a school's
// staff behind one address can still sign in while somebody guesses passwords.
const loginLimiter = rateLimit({
    windowMs: WINDOW_MS,
    max: 10,
    skipSuccessfulRequests: true,
    message: { error: 'Too many failed login attempts, please try again after 15 minutes' },
    standardHeaders: true,
    legacyHeaders: false,
});

// The refresh: 60 per IP in 15 minutes, far above what open tabs need (one per page opened, one per 15-minute token)
const refreshLimiter = rateLimit({
    windowMs: WINDOW_MS,
    max: 60,
    message: { error: 'Too many session renewals, please try again after 15 minutes' },
    standardHeaders: true,
    legacyHeaders: false,
});

module.exports = {
    apiLimiter,
    loginLimiter,
    refreshLimiter,
};
