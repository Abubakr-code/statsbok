const express = require('express');
const mongoose = require('mongoose');
const crypto = require('crypto');
const router = express.Router();

const TelegramUser = require('../models/TelegramUser');
const Quote = require('../models/Quote');
const LibraryBook = require('../models/LibraryBook');
const { searchQuotesEnhanced } = require('../services/searchService');
const { requireAuth } = require('../middleware/auth');

const LINK_CODE_TTL_MS = 15 * 60 * 1000;
const LIBRARY_FREE_MAX_BOOKS = Number(process.env.LIBRARY_FREE_MAX_BOOKS || 20);

const VALID_LANGS = new Set(['uz', 'ru', 'en']);

function getLang(req) {
  return VALID_LANGS.has(req.query.lang) ? req.query.lang : 'uz';
}

// GET /api/telegram/inline?q=...&lang=uz
// Fast search for inline keyboard mode (@bot query)
router.get('/inline', async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim().slice(0, 200);
    if (q.length < 2) return res.json({ results: [] });
    const results = await searchQuotesEnhanced(q, getLang(req));
    res.json({ results: results.slice(0, 8) });
  } catch (err) {
    next(err);
  }
});

// GET /api/telegram/random?lang=uz
router.get('/random', async (req, res, next) => {
  try {
    const lang = getLang(req);
    const count = await Quote.countDocuments({ language: lang });
    if (!count) return res.json({ result: null });
    const doc = await Quote.findOne({ language: lang })
      .skip(Math.floor(Math.random() * count))
      .populate('bookId')
      .lean();
    if (!doc) return res.json({ result: null });
    res.json({
      result: {
        quoteId: doc._id,
        text: doc.text,
        book: doc.bookId || {}
      }
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/telegram/daily-quote?lang=uz
router.get('/daily-quote', async (req, res, next) => {
  try {
    const lang = getLang(req);
    // Prefer verified or high-quality quotes
    const filter = { language: lang };
    const count = await Quote.countDocuments(filter);
    if (!count) return res.json({ quote: null });
    const doc = await Quote.findOne(filter)
      .skip(Math.floor(Math.random() * count))
      .populate('bookId')
      .lean();
    res.json({ quote: doc });
  } catch (err) {
    next(err);
  }
});

// GET /api/telegram/subscribers
router.get('/subscribers', async (req, res, next) => {
  try {
    const users = await TelegramUser.find({ subscribed: true }).lean();
    res.json({ users });
  } catch (err) {
    next(err);
  }
});

// POST /api/telegram/user  — upsert user profile & subscription status
router.post('/user', async (req, res, next) => {
  try {
    const { telegramId, username, firstName, lang, subscribed } = req.body;
    if (!telegramId) return res.status(400).json({ error: 'telegramId required' });
    const update = {};
    if (username !== undefined)  update.username  = username  || null;
    if (firstName !== undefined) update.firstName = firstName || null;
    if (VALID_LANGS.has(lang))   update.lang      = lang;
    if (typeof subscribed === 'boolean') update.subscribed = subscribed;
    const user = await TelegramUser.findOneAndUpdate(
      { telegramId: Number(telegramId) },
      { $set: update },
      { upsert: true, new: true }
    );
    res.json({ ok: true, subscribed: user.subscribed, lang: user.lang });
  } catch (err) {
    next(err);
  }
});

// POST /api/telegram/link/start — bot asks for a one-time code to link a
// Telegram user to a StatBooks account. The user then enters/opens it on the
// site while logged in (see /link/confirm).
router.post('/link/start', async (req, res, next) => {
  try {
    const { telegramId, username, firstName, lang } = req.body;
    if (!telegramId) return res.status(400).json({ error: 'telegramId required' });
    const code = crypto.randomBytes(4).toString('hex').toUpperCase(); // 8 hex chars
    const update = {
      linkCode: code,
      linkCodeExpires: new Date(Date.now() + LINK_CODE_TTL_MS)
    };
    if (username !== undefined) update.username = username || null;
    if (firstName !== undefined) update.firstName = firstName || null;
    if (VALID_LANGS.has(lang)) update.lang = lang;
    await TelegramUser.findOneAndUpdate(
      { telegramId: Number(telegramId) },
      { $set: update },
      { upsert: true, new: true }
    );
    res.json({ ok: true, code, expiresInMinutes: 15 });
  } catch (err) {
    next(err);
  }
});

// POST /api/telegram/link/confirm — called by the logged-in website to bind the
// code (from the bot) to the current account.
router.post('/link/confirm', requireAuth, async (req, res, next) => {
  try {
    const code = String(req.body.code || '').trim().toUpperCase();
    if (!code) return res.status(400).json({ error: 'code required' });
    const tgUser = await TelegramUser.findOne({
      linkCode: code,
      linkCodeExpires: { $gt: new Date() }
    });
    if (!tgUser) return res.status(404).json({ error: 'Kod noto‘g‘ri yoki muddati o‘tgan' });
    tgUser.statbooksUserId = req.user._id;
    tgUser.linkCode = null;
    tgUser.linkCodeExpires = null;
    await tgUser.save();
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/telegram/library/add — bot adds a book to the linked account's
// personal library. Returns { linked: false } when the Telegram user hasn't
// connected an account yet so the bot can prompt them to /link.
router.post('/library/add', async (req, res, next) => {
  try {
    const { telegramId, book } = req.body;
    if (!telegramId || !book || !book.title) {
      return res.status(400).json({ error: 'telegramId and book.title required' });
    }
    const tgUser = await TelegramUser.findOne({ telegramId: Number(telegramId) });
    if (!tgUser || !tgUser.statbooksUserId) return res.json({ linked: false });

    const userId = tgUser.statbooksUserId;

    // Avoid duplicates (same title+author already in this library).
    const existing = await LibraryBook.findOne({
      userId,
      title: book.title,
      author: book.author || ''
    }).lean();
    if (existing) return res.json({ linked: true, added: false, duplicate: true });

    // Basic free-plan cap (premium users are unlimited).
    const User = require('../models/User');
    const account = await User.findById(userId).select('plan').lean();
    if (account?.plan !== 'premium') {
      const count = await LibraryBook.countDocuments({ userId });
      if (count >= LIBRARY_FREE_MAX_BOOKS) {
        return res.json({ linked: true, added: false, limit: true });
      }
    }

    const created = await LibraryBook.create({
      userId,
      title: String(book.title).slice(0, 300),
      author: String(book.author || 'Noma‘lum').slice(0, 200),
      year: book.year || undefined,
      coverUrl: book.coverUrl || undefined,
      genre: book.genre || undefined,
      language: VALID_LANGS.has(book.language) ? book.language : 'uz',
      description: book.description ? String(book.description).slice(0, 2000) : undefined,
      shelf: ['reading', 'finished', 'want', 'wishlist', 'dropped'].includes(book.shelf) ? book.shelf : 'want',
      statbooksBookId: mongoose.Types.ObjectId.isValid(book.statbooksBookId) ? book.statbooksBookId : undefined,
      source: 'statbooks'
    });
    res.json({ linked: true, added: true, bookId: created._id });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
