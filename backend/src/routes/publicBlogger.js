const router = require('express').Router();
const User = require('../models/User');
const Collection = require('../models/Collection');

// ─── Public collection page ───────────────────────────────────────────────────
router.get('/collection/:slug', async (req, res) => {
  try {
    const col = await Collection.findOne({ slug: req.params.slug, isPublic: true })
      .populate('blogger', 'name avatarUrl bloggerProfile')
      .populate({
        path: 'quotes',
        limit: 100,
        populate: { path: 'bookId', select: 'title titleUz author coverImage' }
      })
      .lean();
    if (!col) return res.status(404).json({ error: 'not_found' });

    // Increment view count (fire-and-forget)
    Collection.findByIdAndUpdate(col._id, { $inc: { views: 1 } }).catch(() => {});

    res.json({ collection: col });
  } catch {
    res.status(500).json({ error: 'server_error' });
  }
});

// ─── Public blogger leaderboard ───────────────────────────────────────────────
router.get('/bloggers', async (req, res) => {
  try {
    const bloggers = await User.find({ isBlogger: true })
      .select('name avatarUrl bloggerProfile createdAt')
      .sort({ 'bloggerProfile.widgetClicks': -1 })
      .limit(50)
      .lean();

    // Add collection count for each
    const ids = bloggers.map((b) => b._id);
    const counts = await Collection.aggregate([
      { $match: { blogger: { $in: ids }, isPublic: true } },
      { $group: { _id: '$blogger', count: { $sum: 1 }, totalViews: { $sum: '$views' } } }
    ]);
    const countMap = {};
    counts.forEach((c) => { countMap[String(c._id)] = c; });

    const result = bloggers.map((b) => {
      const c = countMap[String(b._id)] || { count: 0, totalViews: 0 };
      return { ...b, collectionsCount: c.count, totalCollectionViews: c.totalViews };
    });

    res.json({ bloggers: result });
  } catch (err) {
    console.error('bloggers leaderboard error', err);
    res.status(500).json({ error: 'server_error' });
  }
});

// ─── Widget: daily quote ──────────────────────────────────────────────────────
router.get('/widget/daily', async (req, res) => {
  try {
    const Quote = require('../models/Quote');
    const count = await Quote.countDocuments({ verified: true });
    const idx = Math.floor(Date.now() / (24 * 3600 * 1000)) % Math.max(count, 1);
    const quote = await Quote.findOne({ verified: true })
      .skip(idx)
      .populate('bookId', 'title titleUz author coverImage')
      .lean();
    res.json({ quote });
  } catch {
    res.status(500).json({ error: 'server_error' });
  }
});

// ─── Widget: book quotes ──────────────────────────────────────────────────────
router.get('/widget/book/:bookId', async (req, res) => {
  try {
    const Quote = require('../models/Quote');
    const quotes = await Quote.find({ bookId: req.params.bookId })
      .limit(20)
      .populate('bookId', 'title titleUz author coverImage')
      .lean();
    res.json({ quotes });
  } catch {
    res.status(500).json({ error: 'server_error' });
  }
});

module.exports = router;
