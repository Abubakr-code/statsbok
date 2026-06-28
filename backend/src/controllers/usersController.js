const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const User = require('../models/User');
const { publicUser } = require('./authController');

// Max accepted avatar data-URL size (~250 KB) to keep documents small.
const MAX_AVATAR_CHARS = 350 * 1024;

async function saveQuote(req, res, next) {
  try {
    const user = req.user;
    const quoteId = req.params.quoteId;
    const quoteData = req.body; // Optional: contains full quote data for AI results

    // Check if already saved (convert to string for comparison)
    const already = user.savedQuotes.some((id) => String(id) === String(quoteId));
    if (already) return res.json({ ok: true, saved: user.savedQuotes.length });

    const isPremium = user.isPremium();
    if (!isPremium && user.savedQuotes.length >= user.savedLimit) {
      return res.status(403).json({
        error: 'Free plan limit reached. Upgrade to premium for unlimited saves.',
        limit: user.savedLimit
      });
    }

    // Store as-is: both ObjectIds and AI quote string IDs are supported
    user.savedQuotes.push(String(quoteId));
    user.savedQuoteEvents.push({ quote: String(quoteId), savedAt: new Date() });
    // Keep only the last 500 events to prevent unbounded document growth
    if (user.savedQuoteEvents.length > 500) {
      user.savedQuoteEvents = user.savedQuoteEvents.slice(-500);
    }

    // If it's an AI quote (starts with 'ai-'), also store the full quote data
    if (String(quoteId).startsWith('ai-') && quoteData && quoteData.book) {
      user.savedAiQuotes.push({
        id: String(quoteId),
        text: quoteData.text || '',
        book: {
          title: quoteData.book?.title || '',
          titleUz: quoteData.book?.titleUz || null,
          author: quoteData.book?.author || '',
          year: quoteData.book?.year || null,
          coverImage: quoteData.book?.coverImage || null
        },
        confidence: quoteData.confidence || 0.75
      });
    }

    await user.save();
    res.json({ ok: true, saved: user.savedQuotes.length });
  } catch (err) {
    next(err);
  }
}

async function unsaveQuote(req, res, next) {
  try {
    const user = req.user;
    const quoteId = req.params.quoteId;
    user.savedQuotes = user.savedQuotes.filter((id) => String(id) !== String(quoteId));
    user.savedQuoteEvents = (user.savedQuoteEvents || []).filter((item) => String(item.quote) !== String(quoteId));
    user.savedMeta = (user.savedMeta || []).filter((m) => String(m.quote) !== String(quoteId));
    user.savedAiQuotes = (user.savedAiQuotes || []).filter((aq) => aq.id !== String(quoteId));
    await user.save();
    res.json({ ok: true, saved: user.savedQuotes.length });
  } catch (err) {
    next(err);
  }
}

async function weeklySavedStats(req, res, next) {
  try {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const rows = await User.aggregate([
      { $unwind: '$savedQuoteEvents' },
      { $match: { 'savedQuoteEvents.savedAt': { $gte: weekAgo } } },
      { $group: { _id: '$savedQuoteEvents.quote', saves: { $sum: 1 } } },
      { $sort: { saves: -1 } },
      { $limit: 10 }
    ]);

    const objectIds = rows
      .map((row) => String(row._id))
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
      .map((id) => new mongoose.Types.ObjectId(id));

    const Quote = require('../models/Quote');
    const quotes = objectIds.length
      ? await Quote.find({ _id: { $in: objectIds } }).populate('bookId').lean()
      : [];
    const quoteMap = new Map(quotes.map((q) => [String(q._id), q]));

    const stats = rows.map((row) => {
      const quote = quoteMap.get(String(row._id));
      return {
        quoteId: String(row._id),
        saves: row.saves,
        text: quote?.text || '',
        book: quote?.bookId
          ? {
              id: quote.bookId._id,
              title: quote.bookId.titleUz || quote.bookId.title,
              author: quote.bookId.author,
              coverImage: quote.bookId.coverImage || null
            }
          : null
      };
    });

    res.json({ stats });
  } catch (err) {
    next(err);
  }
}

async function savedQuotes(req, res, next) {
  try {
    const user = req.user;

    // Separate real Quote ObjectIds from AI quote strings
    const aiQuoteIds = new Set(user.savedQuotes.filter((id) => String(id).startsWith('ai-')));
    const quoteIds = user.savedQuotes.filter((id) => !String(id).startsWith('ai-'));

    // Fetch DB quotes
    const Quote = require('../models/Quote');
    const Book = require('../models/Book');
    let dbQuotes = [];
    
    if (quoteIds.length > 0) {
      dbQuotes = await Quote.find({
        _id: { $in: quoteIds.map(id => {
          try { return new (require('mongoose')).Types.ObjectId(id); } 
          catch { return null; }
        }).filter(Boolean) }
      }).populate('bookId').lean();
    }

    // Format DB quotes
    const formattedDbQuotes = dbQuotes.map((q) => ({
      _id: q._id,
      quoteId: q._id,
      text: q.text,
      pageNumber: q.pageNumber || null,
      book: q.bookId ? {
        id: q.bookId._id,
        title: q.bookId.titleUz || q.bookId.title,
        titleUz: q.bookId.titleUz || null,
        author: q.bookId.author,
        authorUz: q.bookId.authorUz || null,
        language: q.bookId.language || q.language || null,
        year: q.bookId.year || null,
        coverImage: q.bookId.coverImage || null,
        likes: q.bookId.likes || 0
      } : null,
      source: 'database'
    }));

    // Get stored AI quote data
    const aiQuotes = user.savedAiQuotes.map((aq) => ({
      quoteId: aq.id,
      text: aq.text,
      pageNumber: null,
      confidence: aq.confidence,
      book: aq.book,
      source: 'ai'
    }));

    // Merge quotes in order they were saved
    const allQuotes = [];
    for (const savedId of user.savedQuotes) {
      const dbMatch = formattedDbQuotes.find((q) => String(q._id) === String(savedId));
      const aiMatch = aiQuotes.find((q) => q.quoteId === String(savedId));
      if (dbMatch) allQuotes.push(dbMatch);
      if (aiMatch) allQuotes.push(aiMatch);
    }

    // Build metadata map
    const meta = {};
    for (const m of user.savedMeta || []) {
      if (m.quote) meta[String(m.quote)] = { folder: m.folder || '', tags: m.tags || [] };
    }

    res.json({
      quotes: allQuotes,
      meta,
      count: user.savedQuotes.length,
      limit: user.isPremium() ? null : user.savedLimit
    });
  } catch (err) {
    next(err);
  }
}

// Premium: set folder/tags for a saved quote.
async function setQuoteMeta(req, res, next) {
  try {
    if (!req.user.isPremium()) {
      return res.status(403).json({ error: 'Folders and tags are a premium feature.' });
    }
    const { quoteId } = req.params;
    const isSaved = req.user.savedQuotes.some((id) => String(id) === String(quoteId));
    if (!isSaved) return res.status(404).json({ error: 'Quote not in your archive' });

    const folder = typeof req.body.folder === 'string' ? req.body.folder.trim().slice(0, 60) : '';
    const tags = Array.isArray(req.body.tags)
      ? req.body.tags.map((x) => String(x).trim().slice(0, 30)).filter(Boolean).slice(0, 10)
      : [];

    const entry = req.user.savedMeta.find((m) => String(m.quote) === String(quoteId));
    if (entry) {
      entry.folder = folder;
      entry.tags = tags;
    } else {
      req.user.savedMeta.push({ quote: quoteId, folder, tags });
    }
    await req.user.save();
    res.json({ ok: true, folder, tags });
  } catch (err) {
    next(err);
  }
}

async function profile(req, res) {
  res.json({ user: publicUser(req.user) });
}

async function updateProfile(req, res, next) {
  try {
    const { name, language, bio, avatarUrl } = req.body;
    if (name !== undefined) req.user.name = String(name).slice(0, 80);
    if (language && ['uz', 'en', 'ru'].includes(language)) req.user.language = language;
    if (bio !== undefined) req.user.bio = String(bio).slice(0, 300);

    if (avatarUrl !== undefined) {
      if (avatarUrl === null || avatarUrl === '') {
        req.user.avatarUrl = null;
      } else if (typeof avatarUrl === 'string' && avatarUrl.startsWith('data:image/')) {
        if (avatarUrl.length > MAX_AVATAR_CHARS) {
          return res.status(400).json({ error: 'Image is too large (max ~250KB).' });
        }
        req.user.avatarUrl = avatarUrl;
      } else {
        return res.status(400).json({ error: 'Invalid image data' });
      }
    }

    await req.user.save();
    res.json({ user: publicUser(req.user) });
  } catch (err) {
    next(err);
  }
}

async function changePassword(req, res, next) {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password are required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }
    const ok = await bcrypt.compare(currentPassword, req.user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Current password is incorrect' });

    req.user.passwordHash = await bcrypt.hash(newPassword, 10);
    await req.user.save();
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  saveQuote,
  unsaveQuote,
  savedQuotes,
  weeklySavedStats,
  setQuoteMeta,
  profile,
  updateProfile,
  changePassword
};
