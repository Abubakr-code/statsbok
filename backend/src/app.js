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

// Health check — declared BEFORE CORS so platform health probes (Render, etc.),
// which send no Origin header, are never rejected by the CORS origin guard.
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

app.use(
  cors({
    origin(origin, callback) {
      // Allow requests with no Origin header. CORS is a browser-only protection
      // (curl/bots ignore it anyway), so blocking no-Origin gives no real
      // security while breaking legitimate server-to-server callers: platform
      // health checks, OG link-preview crawlers (Telegram/Facebook), and the
      // Telegram bot. Browser cross-origin requests are still restricted below.
      if (!origin) return callback(null, true);
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

// Telegram bot — runs in-process (webhook). Mounted only when a token is set so
// local dev without a token is unaffected. Must be before the 404 handler.
if (process.env.TELEGRAM_BOT_TOKEN) {
  try {
    require('./bot').mountWebhook(app);
  } catch (err) {
    console.error('[bot] failed to mount:', err.message);
  }
}

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Global error handler (must be last)
app.use(errorHandler);

module.exports = app;
