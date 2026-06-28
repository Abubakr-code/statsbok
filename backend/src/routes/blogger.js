const router = require('express').Router();
const { requireAuth } = require('../middleware/auth');
const User = require('../models/User');
const Collection = require('../models/Collection');
const BloggerApplication = require('../models/BloggerApplication');
const Quote = require('../models/Quote');

// ─── Apply to become a blogger ──────────────────────────────────────────────
router.post('/apply', requireAuth, async (req, res) => {
  try {
    const { channelName, channelLink, followers, niche, bio } = req.body;
    if (!channelName || !channelLink) {
      return res.status(400).json({ error: 'channelName and channelLink required' });
    }
    const existing = await BloggerApplication.findOne({ user: req.user._id });
    if (existing) {
      return res.status(409).json({ error: 'application_exists', status: existing.status });
    }
    const app = await BloggerApplication.create({
      user: req.user._id,
      channelName: channelName.trim(),
      channelLink: channelLink.trim(),
      followers: Number(followers) || 0,
      niche: (niche || '').trim(),
      bio: (bio || '').trim()
    });
    res.status(201).json({ ok: true, status: app.status });
  } catch (err) {
    console.error('blogger apply error', err);
    res.status(500).json({ error: 'server_error' });
  }
});

// ─── Get application status ──────────────────────────────────────────────────
router.get('/application', requireAuth, async (req, res) => {
  try {
    const app = await BloggerApplication.findOne({ user: req.user._id }).lean();
    res.json({ application: app });
  } catch {
    res.status(500).json({ error: 'server_error' });
  }
});

// ─── Get own blogger profile ─────────────────────────────────────────────────
router.get('/profile', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('name email avatarUrl isBlogger bloggerProfile plan premiumUntil')
      .lean();
    res.json({ user });
  } catch {
    res.status(500).json({ error: 'server_error' });
  }
});

// ─── Update blogger profile ──────────────────────────────────────────────────
router.put('/profile', requireAuth, async (req, res) => {
  try {
    const { channelName, channelLink, followers, niche, bio } = req.body;
    const update = {};
    if (channelName !== undefined) update['bloggerProfile.channelName'] = channelName.trim();
    if (channelLink !== undefined) update['bloggerProfile.channelLink'] = channelLink.trim();
    if (followers !== undefined) update['bloggerProfile.followers'] = Number(followers) || 0;
    if (niche !== undefined) update['bloggerProfile.niche'] = niche.trim();
    if (bio !== undefined) update['bloggerProfile.bio'] = bio.trim().slice(0, 500);
    await User.findByIdAndUpdate(req.user._id, { $set: update });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'server_error' });
  }
});

// ─── Stats ───────────────────────────────────────────────────────────────────
router.get('/stats', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('bloggerProfile savedQuoteEvents savedQuotes')
      .lean();

    const now = new Date();
    const thirtyDaysAgo = new Date(now - 30 * 24 * 3600 * 1000);
    const sevenDaysAgo  = new Date(now - 7  * 24 * 3600 * 1000);

    // Daily saves for last 30 days (from platform-wide savedQuoteEvents on own account)
    const events = (user.savedQuoteEvents || []).filter(
      (e) => new Date(e.savedAt) >= thirtyDaysAgo
    );
    const byDay = {};
    events.forEach((e) => {
      const day = new Date(e.savedAt).toISOString().slice(0, 10);
      byDay[day] = (byDay[day] || 0) + 1;
    });
    const savesChart = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now - i * 24 * 3600 * 1000).toISOString().slice(0, 10);
      savesChart.push({ date: d, saves: byDay[d] || 0 });
    }

    // Weekly saves count
    const weekSaves = events.filter((e) => new Date(e.savedAt) >= sevenDaysAgo).length;

    // Collection count + views
    const collections = await Collection.find({ blogger: req.user._id })
      .select('title views isPublic createdAt')
      .lean();
    const totalCollectionViews = collections.reduce((s, c) => s + (c.views || 0), 0);

    res.json({
      widgetClicks:        user.bloggerProfile?.widgetClicks || 0,
      totalCollectionViews,
      weekSaves,
      totalSaved:          (user.savedQuotes || []).length,
      savesChart,
      collectionsCount:    collections.length,
      collections
    });
  } catch (err) {
    console.error('blogger stats error', err);
    res.status(500).json({ error: 'server_error' });
  }
});

// ─── Track widget click (public, no auth) ────────────────────────────────────
router.post('/widget/click', async (req, res) => {
  try {
    const { bloggerId } = req.body;
    if (bloggerId) {
      await User.findByIdAndUpdate(bloggerId, { $inc: { 'bloggerProfile.widgetClicks': 1 } });
    }
    res.json({ ok: true });
  } catch {
    res.json({ ok: true });
  }
});

// ─── Collections ─────────────────────────────────────────────────────────────

function isPremiumUser(user) {
  return user.plan === 'premium' && user.premiumUntil && user.premiumUntil > new Date();
}

router.get('/collections', requireAuth, async (req, res) => {
  try {
    const cols = await Collection.find({ blogger: req.user._id })
      .select('title slug niche quotes isPublic views createdAt')
      .lean();
    // Add quote count
    const result = cols.map((c) => ({ ...c, quoteCount: c.quotes.length }));
    res.json({ collections: result });
  } catch {
    res.status(500).json({ error: 'server_error' });
  }
});

router.post('/collections', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('plan premiumUntil isBlogger').lean();
    // Count existing collections
    const count = await Collection.countDocuments({ blogger: req.user._id });
    const limit = isPremiumUser(user) ? Infinity : 3;
    if (count >= limit) {
      return res.status(403).json({ error: 'collection_limit', limit });
    }
    const { title, titleEn, titleRu, niche, isPublic } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: 'title_required' });
    const col = await Collection.create({
      blogger: req.user._id,
      title: title.trim(),
      titleEn: (titleEn || '').trim(),
      titleRu: (titleRu || '').trim(),
      niche: (niche || '').trim(),
      isPublic: isPublic !== false
    });
    res.status(201).json({ collection: col });
  } catch (err) {
    console.error('create collection', err);
    res.status(500).json({ error: 'server_error' });
  }
});

router.put('/collections/:id', requireAuth, async (req, res) => {
  try {
    const col = await Collection.findOne({ _id: req.params.id, blogger: req.user._id });
    if (!col) return res.status(404).json({ error: 'not_found' });
    const { title, titleEn, titleRu, niche, isPublic } = req.body;
    if (title) col.title = title.trim();
    if (titleEn !== undefined) col.titleEn = titleEn.trim();
    if (titleRu !== undefined) col.titleRu = titleRu.trim();
    if (niche !== undefined) col.niche = niche.trim();
    if (isPublic !== undefined) col.isPublic = Boolean(isPublic);
    await col.save();
    res.json({ collection: col });
  } catch {
    res.status(500).json({ error: 'server_error' });
  }
});

router.delete('/collections/:id', requireAuth, async (req, res) => {
  try {
    const result = await Collection.deleteOne({ _id: req.params.id, blogger: req.user._id });
    if (!result.deletedCount) return res.status(404).json({ error: 'not_found' });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'server_error' });
  }
});

// Add or remove quotes from a collection
router.post('/collections/:id/quotes', requireAuth, async (req, res) => {
  try {
    const col = await Collection.findOne({ _id: req.params.id, blogger: req.user._id });
    if (!col) return res.status(404).json({ error: 'not_found' });
    const { add, remove } = req.body; // arrays of quote IDs
    if (add?.length) {
      const ids = add.filter((id) => !col.quotes.map(String).includes(String(id)));
      col.quotes.push(...ids);
    }
    if (remove?.length) {
      col.quotes = col.quotes.filter((q) => !remove.includes(String(q)));
    }
    await col.save();
    res.json({ ok: true, quoteCount: col.quotes.length });
  } catch {
    res.status(500).json({ error: 'server_error' });
  }
});

// Search quotes to add to collection
router.get('/quotes/search', requireAuth, async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q || q.length < 2) return res.json({ quotes: [] });
    const quotes = await Quote.find(
      { $text: { $search: q } },
      { score: { $meta: 'textScore' } }
    )
      .sort({ score: { $meta: 'textScore' } })
      .limit(10)
      .populate('bookId', 'title titleUz author coverImage')
      .lean();
    res.json({ quotes });
  } catch {
    // Fallback: regex search
    try {
      const quotes = await Quote.find({ text: { $regex: req.query.q, $options: 'i' } })
        .limit(10)
        .populate('bookId', 'title titleUz author coverImage')
        .lean();
      res.json({ quotes });
    } catch {
      res.json({ quotes: [] });
    }
  }
});

module.exports = router;
