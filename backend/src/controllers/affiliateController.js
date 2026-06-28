const mongoose = require('mongoose');
const Book = require('../models/Book');
const Click = require('../models/Click');
const { resolveAffiliate } = require('../services/affiliateService');

/**
 * Record an affiliate click, then 302-redirect to the partner store.
 * GET /api/affiliate/go?bookId=...&quoteId=...
 */
async function go(req, res, next) {
  try {
    const { bookId, quoteId } = req.query;
    if (!mongoose.Types.ObjectId.isValid(bookId)) {
      return res.status(400).json({ error: 'Invalid bookId' });
    }
    const book = await Book.findById(bookId).select('title author affiliateLink').lean();
    if (!book) return res.status(404).json({ error: 'Book not found' });

    const { url, provider } = resolveAffiliate(book);

    // Fire-and-forget tracking; never block the redirect on it.
    const validQuoteId = mongoose.Types.ObjectId.isValid(quoteId) ? quoteId : null;
    Click.create({
      userId: req.user?._id || null,
      bookId: book._id,
      quoteId: validQuoteId,
      provider,
      url
    }).catch(() => {});

    res.redirect(302, url);
  } catch (err) {
    next(err);
  }
}

module.exports = { go };
