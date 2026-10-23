const express = require('express');
const AuthController = require('../controllers/authController');
const { requireAuth } = require('../middleware/authMiddleware');
const { requireJson } = require('../middleware/requireJson');
const { validateLogin } = require('../middleware/validationMiddleware');
const { loginLimiter, refreshLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

router.post('/login', loginLimiter, validateLogin, AuthController.login);
// The session cookie, not an access token, names the session for these two
router.post('/refresh', refreshLimiter, requireJson, AuthController.refresh);
router.post('/logout', requireJson, AuthController.logout);
router.get('/me', requireAuth, AuthController.getMe);

module.exports = router;
