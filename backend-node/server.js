require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { apiLimiter } = require('./src/middleware/rateLimiter');

const authRoutes = require('./src/routes/authRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Security Middleware
app.use(helmet({
    crossOriginResourcePolicy: false, // Permite que o frontend em outra porta acesse os recursos
})); 
app.use(apiLimiter); // Apply global rate limiting

// CORS fully relaxed for local debugging
app.use(cors()); 

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
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Secure Authentication Backend running on http://0.0.0.0:${PORT}`);
});
