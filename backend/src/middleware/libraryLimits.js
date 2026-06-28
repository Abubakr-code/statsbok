const LibraryBook = require('../models/LibraryBook');

const FREE_MAX_BOOKS = parseInt(process.env.LIBRARY_FREE_MAX_BOOKS || '20', 10);
const FREE_MAX_INSIGHTS = parseInt(process.env.LIBRARY_FREE_MAX_INSIGHTS || '5', 10);

async function checkLibraryLimit(req, res, next) {
  if (req.user.plan === 'premium') return next();
  const count = await LibraryBook.countDocuments({ userId: req.user._id });
  if (count >= FREE_MAX_BOOKS) {
    return res.status(403).json({
      error: 'free_limit_reached',
      limit: FREE_MAX_BOOKS,
      message: `Bepul rejada ${FREE_MAX_BOOKS} ta kitob. Premium ga o'ting.`
    });
  }
  next();
}

async function checkInsightLimit(req, res, next) {
  if (req.user.plan === 'premium') return next();
  const book = await LibraryBook.findOne({ _id: req.params.id, userId: req.user._id });
  if (!book) return res.status(404).json({ error: 'Not found' });
  if ((book.insights || []).length >= FREE_MAX_INSIGHTS) {
    return res.status(403).json({
      error: 'insight_limit_reached',
      limit: FREE_MAX_INSIGHTS,
      message: `Bepul rejada kitob boshiga ${FREE_MAX_INSIGHTS} ta tushuncha. Premium ga o'ting.`
    });
  }
  req._libraryBook = book;
  next();
}

module.exports = { checkLibraryLimit, checkInsightLimit, FREE_MAX_BOOKS, FREE_MAX_INSIGHTS };
