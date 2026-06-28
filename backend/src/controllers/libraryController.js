const LibraryBook = require('../models/LibraryBook');
const ReadingGoal = require('../models/ReadingGoal');
const Book = require('../models/Book');
const User = require('../models/User');

// ─── HELPERS ─────────────────────────────────────────────────────────────

function dateKey(d) {
  return new Date(d).toISOString().slice(0, 10);
}

function calcStreaks(sessions) {
  const dates = [...new Set(sessions.map((s) => dateKey(s.date)))].sort();
  if (!dates.length) return { currentStreak: 0, longestStreak: 0 };

  let longestStreak = 1, tempStreak = 1;
  for (let i = 1; i < dates.length; i++) {
    const diff = (new Date(dates[i]) - new Date(dates[i - 1])) / 86400000;
    if (diff === 1) { tempStreak++; if (tempStreak > longestStreak) longestStreak = tempStreak; }
    else tempStreak = 1;
  }

  const todayKey = dateKey(new Date());
  const yesterdayKey = dateKey(new Date(Date.now() - 86400000));
  const lastDate = dates[dates.length - 1];

  let currentStreak = 0;
  if (lastDate === todayKey || lastDate === yesterdayKey) {
    let check = new Date(lastDate);
    for (let i = dates.length - 1; i >= 0; i--) {
      if (dateKey(check) === dates[i]) { currentStreak++; check.setDate(check.getDate() - 1); }
      else break;
    }
  }

  return { currentStreak, longestStreak };
}

// ─── LIBRARY CRUD ─────────────────────────────────────────────────────────

async function getLibrary(req, res) {
  try {
    const userId = req.user._id;
    const { shelf, genre, tag, sort } = req.query;

    const filter = { userId };
    if (shelf && shelf !== 'all') filter.shelf = shelf;
    if (genre) filter.genre = genre;
    if (tag) filter.tags = tag;

    let query = LibraryBook.find(filter).select('-readingSessions -insights -review');

    if (sort === 'rating') query = query.sort({ rating: -1 });
    else if (sort === 'title') query = query.sort({ title: 1 });
    else if (sort === 'author') query = query.sort({ author: 1 });
    else query = query.sort({ updatedAt: -1 });

    const books = await query.lean();
    res.json({ books, total: books.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function addBook(req, res) {
  try {
    const { title, author, year, isbn, coverUrl, genre, language, totalPages, description, tags,
      shelf, currentPage, startedAt, finishedAt, rating, statbooksBookId, source } = req.body;

    if (!title || !author) return res.status(400).json({ error: 'title and author are required' });

    const book = await LibraryBook.create({
      userId: req.user._id,
      title, author, year, isbn, coverUrl, genre,
      language: language || 'uz',
      totalPages, description,
      tags: tags || [],
      shelf: shelf || 'want',
      currentPage: currentPage || 0,
      startedAt: startedAt || (shelf === 'reading' ? new Date() : undefined),
      finishedAt: finishedAt || (shelf === 'finished' ? new Date() : undefined),
      rating, statbooksBookId, source: source || 'manual'
    });

    // Update goal completed count if adding as finished
    if (shelf === 'finished') {
      const year = new Date().getFullYear();
      await ReadingGoal.findOneAndUpdate(
        { userId: req.user._id, year },
        { $inc: { completedBooks: 1 } },
        { upsert: false }
      );
    }

    res.status(201).json({ book });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getBook(req, res) {
  try {
    const book = await LibraryBook.findOne({ _id: req.params.id, userId: req.user._id }).lean();
    if (!book) return res.status(404).json({ error: 'Not found' });
    res.json({ book });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function updateBook(req, res) {
  try {
    const allowed = ['title', 'author', 'year', 'isbn', 'coverUrl', 'genre', 'language',
      'totalPages', 'description', 'tags', 'rating', 'isPublic'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    const book = await LibraryBook.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { $set: updates },
      { new: true }
    );
    if (!book) return res.status(404).json({ error: 'Not found' });
    res.json({ book });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function deleteBook(req, res) {
  try {
    const book = await LibraryBook.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!book) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// ─── SHELF ───────────────────────────────────────────────────────────────

async function changeShelf(req, res) {
  try {
    const { shelf } = req.body;
    const validShelves = ['reading', 'finished', 'want', 'wishlist', 'dropped'];
    if (!validShelves.includes(shelf)) return res.status(400).json({ error: 'Invalid shelf' });

    // Free users can't use wishlist and dropped
    if (req.user.plan !== 'premium' && ['wishlist', 'dropped'].includes(shelf)) {
      return res.status(403).json({ error: 'premium_required', message: 'Wishlist va Dropped faqat Premium foydalanuvchilar uchun.' });
    }

    const updates = { shelf };
    if (shelf === 'reading' && !req.body.startedAt) updates.startedAt = new Date();
    if (shelf === 'finished') {
      if (!req.body.finishedAt) updates.finishedAt = new Date();
      // Update annual goal
      const year = new Date().getFullYear();
      await ReadingGoal.findOneAndUpdate(
        { userId: req.user._id, year },
        { $inc: { completedBooks: 1 } },
        { upsert: false }
      );
    }

    const book = await LibraryBook.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { $set: updates },
      { new: true }
    );
    if (!book) return res.status(404).json({ error: 'Not found' });
    res.json({ book });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// ─── PROGRESS ────────────────────────────────────────────────────────────

async function updateProgress(req, res) {
  try {
    const { currentPage } = req.body;
    if (typeof currentPage !== 'number') return res.status(400).json({ error: 'currentPage required' });

    const book = await LibraryBook.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { $set: { currentPage } },
      { new: true }
    );
    if (!book) return res.status(404).json({ error: 'Not found' });
    res.json({ book });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function addSession(req, res) {
  try {
    const { pagesRead, minutesRead, currentPage } = req.body;
    const session = { date: new Date(), pagesRead: pagesRead || 0, minutesRead: minutesRead || 0 };
    if (currentPage !== undefined) session.currentPage = currentPage;

    const updates = { $push: { readingSessions: session } };
    if (currentPage !== undefined) updates.$set = { currentPage };

    // Update annual goal pages
    if (pagesRead) {
      const year = new Date().getFullYear();
      await ReadingGoal.findOneAndUpdate(
        { userId: req.user._id, year },
        { $inc: { completedPages: pagesRead } },
        { upsert: false }
      );
    }

    const book = await LibraryBook.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      updates,
      { new: true }
    );
    if (!book) return res.status(404).json({ error: 'Not found' });
    res.json({ book });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// ─── REVIEW ──────────────────────────────────────────────────────────────

async function updateReview(req, res) {
  try {
    const { text } = req.body;
    if (typeof text !== 'string') return res.status(400).json({ error: 'text required' });

    const isPremium = req.user.plan === 'premium';
    if (!isPremium && text.length > 500) {
      return res.status(403).json({ error: 'review_too_long', message: 'Bepul rejada taqriz 500 belgidan oshmasin.' });
    }

    const updates = {
      'review.text': text,
      'review.updatedAt': new Date()
    };
    const existing = await LibraryBook.findOne({ _id: req.params.id, userId: req.user._id });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    if (!existing.review?.createdAt) updates['review.createdAt'] = new Date();
    if (!existing.review?.publicSlug) {
      // Generate slug from book title + short id
      const slug = existing.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) + '-' + Date.now().toString(36);
      updates['review.publicSlug'] = slug;
    }

    const book = await LibraryBook.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { $set: updates },
      { new: true }
    );
    res.json({ book });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function toggleReviewPublic(req, res) {
  try {
    if (req.user.plan !== 'premium') {
      return res.status(403).json({ error: 'premium_required', message: 'Taqrizni ulashish faqat Premium uchun.' });
    }
    const book = await LibraryBook.findOne({ _id: req.params.id, userId: req.user._id });
    if (!book) return res.status(404).json({ error: 'Not found' });

    const newState = !book.review?.isPublic;
    await LibraryBook.updateOne({ _id: book._id }, { $set: { 'review.isPublic': newState } });
    res.json({ isPublic: newState, slug: book.review?.publicSlug });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getPublicReview(req, res) {
  try {
    const { username, slug } = req.params;
    const user = await User.findOne({
      $or: [{ name: username }, { email: username }]
    }).select('name avatarUrl').lean();
    if (!user) return res.status(404).json({ error: 'User not found' });

    const book = await LibraryBook.findOne({
      userId: user._id,
      'review.publicSlug': slug,
      'review.isPublic': true
    }).lean();
    if (!book) return res.status(404).json({ error: 'Review not found or not public' });

    res.json({
      user: { name: user.name, avatarUrl: user.avatarUrl },
      book: { title: book.title, author: book.author, coverUrl: book.coverUrl, rating: book.rating },
      review: { text: book.review.text, createdAt: book.review.createdAt }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// ─── INSIGHTS ────────────────────────────────────────────────────────────

async function addInsight(req, res) {
  try {
    const { text, pageNumber } = req.body;
    if (!text) return res.status(400).json({ error: 'text required' });

    const insight = { text, pageNumber, createdAt: new Date() };
    const book = await LibraryBook.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { $push: { insights: insight } },
      { new: true }
    );
    if (!book) return res.status(404).json({ error: 'Not found' });
    res.json({ book });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function deleteInsight(req, res) {
  try {
    const book = await LibraryBook.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { $pull: { insights: { _id: req.params.iid } } },
      { new: true }
    );
    if (!book) return res.status(404).json({ error: 'Not found' });
    res.json({ book });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// ─── STATS ───────────────────────────────────────────────────────────────

async function getStats(req, res) {
  try {
    const userId = req.user._id;
    const books = await LibraryBook.find({ userId }).lean();

    const finished = books.filter((b) => b.shelf === 'finished');
    const reading = books.filter((b) => b.shelf === 'reading');
    const allSessions = books.flatMap((b) => b.readingSessions || []);

    let totalPages = 0, totalMinutes = 0;
    allSessions.forEach((s) => { totalPages += s.pagesRead || 0; totalMinutes += s.minutesRead || 0; });

    const { currentStreak, longestStreak } = calcStreaks(allSessions);

    const genreCounts = {};
    books.forEach((b) => { if (b.genre) genreCounts[b.genre] = (genreCounts[b.genre] || 0) + 1; });
    const favoriteGenre = Object.entries(genreCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

    const authorCounts = {};
    books.forEach((b) => { if (b.author) authorCounts[b.author] = (authorCounts[b.author] || 0) + 1; });
    const favoriteAuthor = Object.entries(authorCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

    const thisYear = new Date().getFullYear();
    const thisMonth = new Date().getMonth();
    const booksThisYear = finished.filter((b) => b.finishedAt && new Date(b.finishedAt).getFullYear() === thisYear).length;
    const pagesThisMonth = allSessions.filter((s) => new Date(s.date).getMonth() === thisMonth && new Date(s.date).getFullYear() === thisYear).reduce((sum, s) => sum + (s.pagesRead || 0), 0);

    const ratedBooks = finished.filter((b) => b.rating);
    const averageRating = ratedBooks.length > 0 ? Math.round((ratedBooks.reduce((s, b) => s + b.rating, 0) / ratedBooks.length) * 10) / 10 : 0;

    res.json({
      totalBooks: books.length,
      finishedBooks: finished.length,
      currentlyReading: reading.length,
      wantToRead: books.filter((b) => b.shelf === 'want').length,
      totalPages, totalMinutes,
      averageRating, favoriteGenre, favoriteAuthor,
      booksThisYear, pagesThisMonth,
      longestStreak, currentStreak
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getCalendar(req, res) {
  try {
    const userId = req.user._id;
    const isPremium = req.user.plan === 'premium';
    const days = isPremium ? 365 : 30;

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const books = await LibraryBook.find({ userId }).lean();
    const calendar = {};

    for (const book of books) {
      for (const session of book.readingSessions || []) {
        if (new Date(session.date) < cutoff) continue;
        const key = dateKey(session.date);
        if (!calendar[key]) calendar[key] = { pages: 0, minutes: 0 };
        calendar[key].pages += session.pagesRead || 0;
        calendar[key].minutes += session.minutesRead || 0;
      }
    }

    res.json(calendar);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// ─── GOALS ───────────────────────────────────────────────────────────────

async function getGoal(req, res) {
  try {
    const year = parseInt(req.params.year, 10) || new Date().getFullYear();
    const goal = await ReadingGoal.findOne({ userId: req.user._id, year }).lean();

    // Compute actual finished count for the year
    const actualFinished = await LibraryBook.countDocuments({
      userId: req.user._id,
      shelf: 'finished',
      finishedAt: { $gte: new Date(`${year}-01-01`), $lt: new Date(`${year + 1}-01-01`) }
    });

    if (!goal) return res.json({ goal: null, actualFinished });
    res.json({ goal: { ...goal, completedBooks: actualFinished }, actualFinished });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function setGoal(req, res) {
  try {
    const { year, targetBooks, targetPages } = req.body;
    const y = year || new Date().getFullYear();
    if (!targetBooks || targetBooks < 1) return res.status(400).json({ error: 'targetBooks required' });

    const goal = await ReadingGoal.findOneAndUpdate(
      { userId: req.user._id, year: y },
      { userId: req.user._id, year: y, targetBooks, targetPages: targetPages || null },
      { upsert: true, new: true }
    );
    res.json({ goal });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// ─── ISBN / LOOKUP ────────────────────────────────────────────────────────

async function lookupISBN(req, res) {
  try {
    const { isbn } = req.params;
    const cleaned = isbn.replace(/[-\s]/g, '');

    // Open Library
    const olUrl = `https://openlibrary.org/api/books?bibkeys=ISBN:${cleaned}&format=json&jscmd=data`;
    const olRes = await fetch(olUrl, { signal: AbortSignal.timeout(6000) });
    const olData = await olRes.json();
    const olBook = olData[`ISBN:${cleaned}`];

    if (olBook) {
      return res.json({
        title: olBook.title,
        author: olBook.authors?.[0]?.name || '',
        year: olBook.publish_date ? parseInt(olBook.publish_date, 10) || null : null,
        coverUrl: olBook.cover?.large || olBook.cover?.medium || null,
        totalPages: olBook.number_of_pages || null,
        description: olBook.notes || null,
        isbn: cleaned,
        source: 'openlibrary'
      });
    }

    // Google Books fallback
    const gbKey = process.env.GOOGLE_BOOKS_API_KEY;
    const gbUrl = `https://www.googleapis.com/books/v1/volumes?q=isbn:${cleaned}${gbKey ? `&key=${gbKey}` : ''}`;
    const gbRes = await fetch(gbUrl, { signal: AbortSignal.timeout(6000) });
    const gbData = await gbRes.json();
    const item = gbData.items?.[0]?.volumeInfo;

    if (!item) return res.status(404).json({ error: 'Book not found' });

    res.json({
      title: item.title,
      author: item.authors?.[0] || '',
      year: item.publishedDate ? parseInt(item.publishedDate, 10) || null : null,
      coverUrl: item.imageLinks?.thumbnail?.replace('http:', 'https:') || null,
      totalPages: item.pageCount || null,
      description: item.description || null,
      isbn: cleaned,
      source: 'googlebooks'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function lookupByQuery(req, res) {
  try {
    const q = (req.query.q || '').trim();
    if (!q) return res.status(400).json({ error: 'q required' });

    const gbKey = process.env.GOOGLE_BOOKS_API_KEY;
    const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=8${gbKey ? `&key=${gbKey}` : ''}`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(6000) });
    const data = await resp.json();

    const results = (data.items || []).map((item) => {
      const v = item.volumeInfo;
      const isbn = (v.industryIdentifiers || []).find((x) => x.type === 'ISBN_13' || x.type === 'ISBN_10')?.identifier;
      return {
        title: v.title,
        author: v.authors?.[0] || '',
        year: v.publishedDate ? parseInt(v.publishedDate, 10) || null : null,
        coverUrl: v.imageLinks?.thumbnail?.replace('http:', 'https:') || null,
        totalPages: v.pageCount || null,
        description: v.description || null,
        isbn: isbn || null
      };
    });

    res.json({ results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  getLibrary, addBook, getBook, updateBook, deleteBook,
  changeShelf, updateProgress, addSession,
  updateReview, toggleReviewPublic, getPublicReview,
  addInsight, deleteInsight,
  getStats, getCalendar,
  getGoal, setGoal,
  lookupISBN, lookupByQuery
};
