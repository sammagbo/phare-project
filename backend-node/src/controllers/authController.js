const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const UserModel = require('../models/userModel');
const TokenModel = require('../models/tokenModel');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key';
const REFRESH_SECRET = process.env.REFRESH_SECRET || 'fallback_refresh_secret';

const AuthController = {
    register: async (req, res) => {
        try {
            const { email, password } = req.body;
            
            const existingUser = await UserModel.findByEmail(email);
            if (existingUser) {
                return res.status(409).json({ error: 'User with this email already exists' });
            }

            const saltRounds = 10;
            const hashedPassword = await bcrypt.hash(password, saltRounds);
            const newUserId = await UserModel.create(email, hashedPassword);

            return res.status(201).json({ message: 'User registered successfully', userId: newUserId });
        } catch (err) {
            console.error("Registration error:", err);
            return res.status(500).json({ error: 'Internal server error' });
        }
    },

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

            const payload = {
                id: user.id,
                email: user.email
            };

            // Sign short-lived access token (e.g., 15 minutes)
            const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '15m' });

            // Generate opaque refresh token
            const refreshToken = uuidv4();
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + 7); // Valid for 7 days
            
            await TokenModel.saveRefreshToken(refreshToken, user.id, expiresAt);

            return res.status(200).json({
                message: 'Login successful',
                token: token,
                refreshToken: refreshToken,
                user: { id: user.id, email: user.email }
            });

        } catch (err) {
            console.error("Login error:", err);
            return res.status(500).json({ error: 'Internal server error' });
        }
    },
    
    refresh: async (req, res) => {
        try {
            const { refreshToken } = req.body;
            if (!refreshToken) {
                return res.status(401).json({ error: "Refresh token is required" });
            }
            
            const tokenRecord = await TokenModel.findRefreshToken(refreshToken);
            
            if (!tokenRecord) {
                return res.status(403).json({ error: "Invalid refresh token" });
            }
            
            if (new Date(tokenRecord.expires_at) < new Date()) {
                await TokenModel.deleteRefreshToken(refreshToken);
                return res.status(403).json({ error: "Refresh token has expired. Please login again." });
            }
            
            const user = await UserModel.findById(tokenRecord.user_id);
            if (!user) {
                return res.status(403).json({ error: "Invalid refresh token" });
            }
            
            // Issue new access token
            const payload = { id: user.id, email: user.email };
            const newAccessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: '15m' });
            
            return res.status(200).json({ token: newAccessToken });
            
        } catch (err) {
             console.error("Refresh token error:", err);
             return res.status(500).json({ error: 'Internal server error' });
        }
    },
    
    logout: async (req, res) => {
        try {
            // Ideally, we'd delete the specific refresh token sent in the body or cookies
            const { refreshToken } = req.body;
            if (refreshToken) {
                await TokenModel.deleteRefreshToken(refreshToken);
            }
            res.status(200).json({ message: "Logged out successfully" });
        } catch (err) {
            console.error("Logout error:", err);
            return res.status(500).json({ error: 'Internal server error' });
        }
    },

    getMe: async (req, res) => {
        try {
            const userId = req.user.id;
            const user = await UserModel.findById(userId);
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }
            return res.status(200).json({ user });
        } catch (err) {
            console.error("getMe error:", err);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }
};

module.exports = AuthController;
