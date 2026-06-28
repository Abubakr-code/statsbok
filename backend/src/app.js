const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const mongoSanitize = require('express-mongo-sanitize');
const hpp = require('hpp');
const { apiLimiter } = require('./middleware/rateLimiter');
const { securityHeaders, blockSuspiciousPaths } = require('./middleware/security');
const errorHandler = require('./middleware/errorHandler');

const app = express();
app.disable('x-powered-by');

const isProduction = process.env.NODE_ENV === 'production';

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  ...(process.env.FRONTEND_URL || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
];

// Behind a reverse proxy (nginx) on a VPS, trust the first proxy hop so
// express-rate-limit reads the real client IP from X-Forwarded-For.
if (isProduction) {
  app.set('trust proxy', 1);
}

app.use(securityHeaders());
app.use(blockSuspiciousPaths);

app.use(
  cors({
    origin(origin, callback) {
      // In production, block requests with no Origin header (direct curl/bot attacks).
      // In development, allow browserless calls (Postman, local scripts).
      if (!origin) {
        if (isProduction) return callback(new Error('Origin required'));
        return callback(null, true);
      }
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true
  })
);

// Parse bodies with tight size limits to prevent large-payload DoS.
app.use(express.json({ limit: '200kb' }));
// extended:false uses the simpler querystring parser — prevents prototype-pollution
// attacks that qs (extended:true) is vulnerable to via nested object notation.
app.use(express.urlencoded({ extended: false, limit: '50kb' }));
app.use(cookieParser());

// Strip MongoDB operators ($gt, $where, etc.) from req.body / req.query / req.params
// before any route handler sees the data. Prevents NoSQL injection attacks.
app.use(mongoSanitize());

// Prevent HTTP Parameter Pollution (duplicate query params like ?sort=asc&sort=desc).
app.use(hpp());

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// General rate limit on all API routes.
app.use('/api', apiLimiter);

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/quotes', require('./routes/quotes'));
app.use('/api/books', require('./routes/books'));
app.use('/api/users', require('./routes/users'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/affiliate', require('./routes/affiliate'));
app.use('/api/share', require('./routes/share'));
app.use('/api/telegram', require('./routes/telegram'));
app.use('/api/blogger', require('./routes/blogger'));
app.use('/api/public', require('./routes/publicBlogger'));
app.use('/api/library', require('./routes/library'));
app.use('/api', require('./routes/publicLibrary'));

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Global error handler (must be last)
app.use(errorHandler);

module.exports = app;
