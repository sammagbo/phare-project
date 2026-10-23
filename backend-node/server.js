require('dotenv').config({ quiet: true });
const { assertSecret } = require('./src/token');

// The secret shared with the pHARe API signs every access token: without it, or with less than 32 bytes, the service
// does not start. Run directly, it says why and exits with 1; required by a test, it throws.
try {
    assertSecret();
} catch (err) {
    if (require.main !== module) throw err;
    console.error(err.message);
    process.exit(1);
}

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { apiLimiter } = require('./src/middleware/rateLimiter');
const authRoutes = require('./src/routes/authRoutes');
const db = require('./src/db/database');

const PORT = process.env.PORT || 3000;
// The origins of the frontend, the same list as the API's (PHARE_ALLOWED_ORIGINS, comma-separated)
const ALLOWED_ORIGINS = (process.env.PHARE_ALLOWED_ORIGINS || 'http://localhost:8000,http://127.0.0.1:8000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

const app = express();

// Security Middleware
app.use(helmet({
    crossOriginResourcePolicy: false, // Permite que o frontend em outra porta acesse os recursos
}));
app.use(apiLimiter); // Apply global rate limiting

// CORS: only the frontend's origins; any other origin gets no Access-Control-Allow-Origin
app.use(cors({
    origin: ALLOWED_ORIGINS,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type'],
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

// Start the server only when run directly (`node server.js`); the tests import the app
if (require.main === module) {
    db.ready
        .then(() => {
            app.listen(PORT, '0.0.0.0', () => {
                console.log(`🚀 Secure Authentication Backend running on http://0.0.0.0:${PORT}`);
            });
        })
        .catch((err) => {
            console.error('Failed to prepare the SQLite database:', err.message);
            process.exit(1);
        });
}

module.exports = app;
