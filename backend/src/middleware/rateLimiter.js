const rateLimit = require('express-rate-limit');

const defaults = {
  standardHeaders: true,
  legacyHeaders: false,
};

// General API limiter: keeps scanners and noisy clients away.
const apiLimiter = rateLimit({
  ...defaults,
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: { error: 'Too many requests, please try again later.' },
});

// Auth routes (login, register, forgot-password): tight to stop credential stuffing.
const authLimiter = rateLimit({
  ...defaults,
  windowMs: 15 * 60 * 1000,
  max: 8,
  message: { error: 'Too many attempts, please try again later.' },
});

// Code verification: even tighter — only 5 guesses per 15 min per IP.
// A 6-digit code has 900 000 combinations; 5 guesses makes brute force take centuries.
const codeLimiter = rateLimit({
  ...defaults,
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many code attempts. Wait 15 minutes and try again.' },
});

// Search (AI-powered, slow): reasonable per-minute cap.
const searchLimiter = rateLimit({
  ...defaults,
  windowMs: 60 * 1000,
  max: 20,
  message: { error: 'Too many searches, slow down a moment.' },
});

// AI chat: free OpenRouter models rate-limit upstream too; add a local cap.
const aiChatLimiter = rateLimit({
  ...defaults,
  windowMs: 60 * 1000,
  max: 15,
  message: { error: 'Too many AI requests, please slow down.' },
});

module.exports = { apiLimiter, searchLimiter, authLimiter, codeLimiter, aiChatLimiter };
