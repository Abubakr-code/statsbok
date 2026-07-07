const router = require('express').Router();
const mongoose = require('mongoose');
const User = require('../models/User');
const Collection = require('../models/Collection');
const { optionalAuth, requireAuth } = require('../middleware/auth');

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

// ─── Weekly top quotes (public, used by Telegram bot /top) ───────────────────
router.get('/weekly-top', async (req, res) => {
  try {
    const Quote = require('../models/Quote');
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const rows = await User.aggregate([
      { $unwind: '$savedQuoteEvents' },
      { $match: { 'savedQuoteEvents.savedAt': { $gte: weekAgo } } },
      { $group: { _id: '$savedQuoteEvents.quote', saves: { $sum: 1 } } },
      { $sort: { saves: -1 } },
      { $limit: 10 }
    ]);

    const objectIds = rows
      .map((r) => String(r._id))
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
      .map((id) => new mongoose.Types.ObjectId(id));

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
    }).filter((s) => s.text);

    res.json({ stats });
  } catch (err) {
    console.error('weekly-top error', err);
    res.status(500).json({ error: 'server_error' });
  }
});

// ─── Blogger profile (public) ─────────────────────────────────────────────────
router.get('/bloggers/:id', optionalAuth, async (req, res) => {
  try {
    const blogger = await User.findOne({ _id: req.params.id, isBlogger: true })
      .select('name avatarUrl bio bloggerProfile createdAt')
      .lean();
    if (!blogger) return res.status(404).json({ error: 'not_found' });

    const [collections, followerCount] = await Promise.all([
      Collection.find({ blogger: blogger._id, isPublic: true })
        .select('title slug views createdAt')
        .sort({ views: -1 })
        .limit(20)
        .lean(),
      User.countDocuments({ followedBloggers: blogger._id })
    ]);

    const isFollowing = req.user
      ? (req.user.followedBloggers || []).some((id) => String(id) === String(blogger._id))
      : false;

    res.json({ blogger: { ...blogger, followerCount, collections, isFollowing } });
  } catch (err) {
    res.status(500).json({ error: 'server_error' });
  }
});

// ─── Follow a blogger ─────────────────────────────────────────────────────────
router.post('/bloggers/:id/follow', requireAuth, async (req, res) => {
  try {
    const bloggerId = req.params.id;
    if (String(req.user._id) === String(bloggerId)) {
      return res.status(400).json({ error: 'cannot_follow_self' });
    }
    const blogger = await User.findOne({ _id: bloggerId, isBlogger: true }).lean();
    if (!blogger) return res.status(404).json({ error: 'not_found' });

    await User.findByIdAndUpdate(req.user._id, {
      $addToSet: { followedBloggers: bloggerId }
    });

    const followerCount = await User.countDocuments({ followedBloggers: bloggerId });
    res.json({ following: true, followerCount });
  } catch (err) {
    res.status(500).json({ error: 'server_error' });
  }
});

// ─── Unfollow a blogger ───────────────────────────────────────────────────────
router.delete('/bloggers/:id/follow', requireAuth, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, {
      $pull: { followedBloggers: req.params.id }
    });
    const followerCount = await User.countDocuments({ followedBloggers: req.params.id });
    res.json({ following: false, followerCount });
  } catch (err) {
    res.status(500).json({ error: 'server_error' });
  }
});

module.exports = router;
