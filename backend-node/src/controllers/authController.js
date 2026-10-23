const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const UserModel = require('../models/userModel');
const TokenModel = require('../models/tokenModel');
const { signAccessToken } = require('../token');

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

            // Sign the short-lived access token of the contract (15 minutes), for the pHARe API
            const token = signAccessToken(user);

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
            const newAccessToken = signAccessToken(user);
            
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
            const userId = Number(req.user.sub);
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
