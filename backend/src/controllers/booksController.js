const mongoose = require('mongoose');
const Book = require('../models/Book');
const Quote = require('../models/Quote');
const Order = require('../models/Order');
const { generateBookPreview } = require('../services/searchService');

const PREVIEW_SENTENCES = 15;
const FREE_PAGES = 15;  // Show up to 15 sentences for free preview
const PREMIUM_BONUS = 1;

async function getById(req, res, next) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid book id' });
    }
    const book = await Book.findById(req.params.id).lean();
    if (!book) return res.status(404).json({ error: 'Book not found' });
    res.json({ book });
  } catch (err) {
    next(err);
  }
}

/**
 * Build readable "pages" from the book's stored quotes (in document order)
 * when no curated previewPages exist. Centers the window on the matched quote
 * so the user sees the surrounding context.
 */
async function buildPagesFromQuotes(bookId, quoteId) {
  const quotes = await Quote.find({ bookId })
    .sort({ _id: 1 })
    .select('text')
    .lean();
  if (!quotes.length) return [];

  const sentences = quotes.map((q) => (q.text || '').trim()).filter(Boolean);
  if (!sentences.length) return [];

  // Center the 15-sentence preview around the matched quote when possible.
  let center = 0;
  if (quoteId && mongoose.Types.ObjectId.isValid(quoteId)) {
    const match = await Quote.findById(quoteId).select('text').lean();
    const needle = match?.text?.trim().slice(0, 40).toLowerCase();
    if (needle) {
      const idx = sentences.findIndex((p) => p.toLowerCase().includes(needle));
      if (idx >= 0) center = idx;
    }
  }

  const start = Math.max(0, center - Math.floor(PREVIEW_SENTENCES / 2));
  return sentences.slice(start, start + PREVIEW_SENTENCES);
}

async function preview(req, res, next) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid book id' });
    }
    const book = await Book.findById(req.params.id)
      .select('title author previewPages affiliateLink isSentencePreview language')
      .lean();
    if (!book) return res.status(404).json({ error: 'Book not found' });

    const isPremium = typeof req.user?.isPremium === 'function' ? req.user.isPremium() : false;
    const maxPages = FREE_PAGES + (isPremium ? PREMIUM_BONUS : 0);

    let allPages = book.previewPages && book.previewPages.length
      ? book.previewPages
      : [];

    let isSentencePreview = book.isSentencePreview || false;

    if (allPages.length === 0) {
      allPages = await buildPagesFromQuotes(book._id, req.query.quoteId);
    }

    if (allPages.length === 0) {
      // Fallback: use AI to generate 15 key sentences from the book
      const lang = req.query.lang || book.language || 'en';
      allPages = await generateBookPreview(book.title, book.author, lang);
      if (allPages && allPages.length > 0) {
        isSentencePreview = true;
        // Save to DB so we don't have to generate it next time
        await Book.findByIdAndUpdate(book._id, {
          previewPages: allPages.slice(0, PREVIEW_SENTENCES),
          isSentencePreview: true
        });
      }
    }

    const total = allPages.length;
    res.json({
      bookId: book._id,
      title: book.title,
      author: book.author,
      previewPages: allPages.slice(0, maxPages),
      hasMore: total > maxPages,
      isPremium,
      freePages: FREE_PAGES,
      premiumBonus: PREMIUM_BONUS,
      affiliateLink: book.affiliateLink || null,
      isSentencePreview
    });
  } catch (err) {
    next(err);
  }
}

async function trending(req, res, next) {
  try {
    const filter = {};
    if (req.query.lang && ['uz', 'en', 'ru'].includes(req.query.lang)) {
      filter.language = req.query.lang;
    }
    let books = await Book.find(filter)
      .sort({ likes: -1, totalQuotes: -1, createdAt: -1 })
      .limit(80)
      .lean();

    if (books.length < 8 && filter.language) {
      const additional = await Book.find({ language: { $ne: filter.language } })
        .sort({ likes: -1, totalQuotes: -1, createdAt: -1 })
        .limit(80)
        .lean();
      books = [...books, ...additional];
    }

    // Home should show polished popular books first: cover, user likes, then quote depth.
    books.sort((a, b) => {
      const aHasCover = a.coverImage ? 1 : 0;
      const bHasCover = b.coverImage ? 1 : 0;
      if (aHasCover !== bHasCover) return bHasCover - aHasCover;
      const likes = (b.likes || 0) - (a.likes || 0);
      if (likes !== 0) return likes;
      return (b.totalQuotes || 0) - (a.totalQuotes || 0);
    });

    res.json({ books: books.slice(0, 16) });
  } catch (err) {
    next(err);
  }
}

async function bestSellers(req, res, next) {
  try {
    const rows = await Order.aggregate([
      { $match: { type: 'book_purchase', status: 'paid', bookId: { $ne: null } } },
      { $group: { _id: '$bookId', sold: { $sum: 1 } } },
      { $sort: { sold: -1 } },
      { $limit: 10 }
    ]);

    const books = rows.length
      ? await Book.find({ _id: { $in: rows.map((row) => row._id) } }).lean()
      : [];
    const bookMap = new Map(books.map((book) => [String(book._id), book]));

    res.json({
      books: rows
        .map((row) => {
          const book = bookMap.get(String(row._id));
          return book ? { ...book, sold: row.sold } : null;
        })
        .filter(Boolean)
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Like a book — atomic, race-safe.
 */
async function like(req, res, next) {
  try {
    const trackId = req.user?._id ? String(req.user._id) : req.ip;

    // Atomic: only push + increment if not already liked
    const updated = await Book.findOneAndUpdate(
      { _id: req.params.id, likedBy: { $ne: trackId } },
      { $push: { likedBy: trackId }, $inc: { likes: 1 } },
      { new: true, select: 'likes' }
    );

    if (!updated) {
      const book = await Book.findById(req.params.id).select('likes').lean();
      if (!book) return res.status(404).json({ error: 'Book not found' });
      return res.json({ likes: book.likes, isLiked: true });
    }

    res.json({ likes: updated.likes, isLiked: true });
  } catch (err) {
    next(err);
  }
}

/**
 * Unlike a book — atomic, only decrements if user had actually liked.
 */
async function unlike(req, res, next) {
  try {
    const trackId = req.user?._id ? String(req.user._id) : req.ip;

    const updated = await Book.findOneAndUpdate(
      { _id: req.params.id, likedBy: trackId },
      { $pull: { likedBy: trackId }, $inc: { likes: -1 } },
      { new: true, select: 'likes' }
    );

    if (!updated) {
      const book = await Book.findById(req.params.id).select('likes').lean();
      if (!book) return res.status(404).json({ error: 'Book not found' });
      return res.json({ likes: book.likes, isLiked: false });
    }

    res.json({ likes: Math.max(0, updated.likes), isLiked: false });
  } catch (err) {
    next(err);
  }
}

/**
 * Get book likes
 */
async function getLikes(req, res, next) {
  try {
    const book = await Book.findById(req.params.id).select('likes');
    if (!book) return res.status(404).json({ error: 'Book not found' });
    res.json({ likes: book.likes || 0 });
  } catch (err) {
    next(err);
  }
}

module.exports = { getById, preview, trending, bestSellers, like, unlike, getLikes };
