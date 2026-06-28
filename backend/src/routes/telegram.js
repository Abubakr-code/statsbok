const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

const TelegramUser = require('../models/TelegramUser');
const Quote = require('../models/Quote');
const { searchQuotesEnhanced } = require('../services/searchService');

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

module.exports = router;
