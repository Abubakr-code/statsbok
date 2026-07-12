const mongoose = require('mongoose');
const Quote = require('../models/Quote');
const { searchQuotesEnhanced } = require('../services/searchService');

async function search(req, res, next) {
  try {
    const q = Array.isArray(req.query.q) ? req.query.q[0] : req.query.q;
    const lang = req.query.lang || 'uz';
    if (!q || !String(q).trim()) {
      return res.status(400).json({ error: 'Query parameter q is required' });
    }
    // ?debug=1 returns a provider trace so we can see which AI path answered.
    const diag = req.query.debug ? [] : null;
    const results = await searchQuotesEnhanced(q, lang, diag);
    res.json({ query: q, count: results.length, results, ...(diag ? { diag } : {}) });
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid quote id' });
    }
    const quote = await Quote.findById(req.params.id).populate('bookId');
    if (!quote) return res.status(404).json({ error: 'Quote not found' });
    res.json({ quote });
  } catch (err) {
    next(err);
  }
}

async function trending(req, res, next) {
  try {
    const quotes = await Quote.find({ verified: true })
      .sort({ upvotes: -1, createdAt: -1 })
      .limit(10)
      .populate('bookId')
      .lean();
    res.json({ quotes });
  } catch (err) {
    next(err);
  }
}

module.exports = { search, getById, trending };
