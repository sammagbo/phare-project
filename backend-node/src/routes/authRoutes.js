const express = require('express');
const AuthController = require('../controllers/authController');
const { requireAuth } = require('../middleware/authMiddleware');
const { validateLogin } = require('../middleware/validationMiddleware');
const { authLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

router.post('/login', authLimiter, validateLogin, AuthController.login);
router.post('/refresh', AuthController.refresh);
router.post('/logout', requireAuth, AuthController.logout);
router.get('/me', requireAuth, AuthController.getMe);

module.exports = router;
