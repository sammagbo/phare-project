require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { apiLimiter } = require('./src/middleware/rateLimiter');

const authRoutes = require('./src/routes/authRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Security Middleware
app.use(helmet()); // Secure HTTP headers
app.use(apiLimiter); // Apply global rate limiting

// CORS temporarily relaxed for local network testing
app.use(cors({
    origin: '*', // Allows any origin (tablet, phone, secondary PCs)
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json()); // Parse JSON bodies

// Health check route
app.get('/health', (req, res) => {
    res.json({ status: 'OK', message: 'Secure Auth service is running.' });
});

// API Routes
app.use('/api/auth', authRoutes);

// Global Error Handler to prevent leaking stack traces
app.use((err, req, res, next) => {
    console.error("Unhandled Application Error:", err.stack);
    res.status(500).json({ error: 'An unexpected error occurred. Please try again later.' });
});

// Start Server
app.listen(PORT, () => {
    console.log(`🚀 Secure Authentication Backend running on http://localhost:${PORT}`);
});
