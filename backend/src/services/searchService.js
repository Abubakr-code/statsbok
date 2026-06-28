const Quote = require('../models/Quote');
const Book = require('../models/Book');
const { normalize } = require('../utils/textNormalizer');
const { hasCyrillic, cyrillicToLatin, latinToCyrillic } = require('../utils/cyrillicConverter');
const { detectLanguage } = require('../utils/languageDetector');

const ATLAS_INDEX = 'quotes_search';
const MIN_SCORE = 0.5;
const RESULT_LIMIT = 20;
const ENABLE_AI_SEARCH = process.env.ENABLE_AI_SEARCH !== 'false';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_SEARCH_API_KEY = process.env.OPENROUTER_SEARCH_API_KEY || process.env.OPENROUTER_API_KEY;
const OPENROUTER_SEARCH_MODEL =
  process.env.OPENROUTER_SEARCH_MODEL || process.env.OPENROUTER_MODEL || 'google/gemma-4-31b-it:free';
const GOOGLE_BOOKS_API = 'https://www.googleapis.com/books/v1/volumes';
const GOOGLE_BOOKS_KEY = process.env.GOOGLE_BOOKS_API_KEY;

// Simple in-memory search cache (TTL: 5 minutes, periodic eviction every 5 minutes)
const searchCache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

// Model cooldown after 429 — don't retry a rate-limited model for 60 seconds
const modelCooldown = new Map();
const MODEL_COOLDOWN_MS = 60_000;
function isModelCoolingDown(model) {
  const until = modelCooldown.get(model);
  return until && Date.now() < until;
}
function setCooldown(model) {
  modelCooldown.set(model, Date.now() + MODEL_COOLDOWN_MS);
}

setInterval(() => {
  const now = Date.now();
  for (const [key, val] of searchCache) {
    if (now - val.ts > CACHE_TTL) searchCache.delete(key);
  }
}, CACHE_TTL).unref();
const UZ_BOOK_STOP_WORDS = new Set([
  'asar', 'asari', 'asarlari', 'kitob', 'kitobi', 'kitoblar', 'kitoblari',
  'haqida', 'top', 'qidir', 'qidiruv', 'menga', 'manga', 'ber', 'chiqar'
]);
const EN_TITLE_HINTS = new Set(['literary', 'classical', 'genius', 'poet', 'novel', 'stories', 'history']);
const SUBJECT_ALIASES = {
  adabiyot: ['adabiyot', 'o‘zbek adabiyoti', "o'zbek adabiyoti"],
  matematika: ['matematika', 'algebra', 'geometriya'],
  algebra: ['algebra', 'matematika'],
  geometriya: ['geometriya', 'matematika'],
  fizika: ['fizika'],
  kimyo: ['kimyo'],
  biologiya: ['biologiya'],
  tarix: ['tarix', "o'zbekiston tarixi", 'jahon tarixi'],
  geografiya: ['geografiya'],
  ingliz: ['ingliz tili', 'english'],
  english: ['ingliz tili', 'english'],
  ona: ['ona tili', "o'zbek tili"],
  tili: ['ona tili', "o'zbek tili"],
  informatika: ['informatika', 'axborot texnologiyalari']
};

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Build a regex source that treats every apostrophe variant interchangeably,
// so an author/title query like "O'tkir" matches stored "Oʻtkir"/"O‘tkir".
const APOSTROPHE_CLASS = "['\u02bb\u02bc\u2018\u2019\u0060\u00b4]";
function flexibleRegex(value) {
  return escapeRegex(value).replace(/['\u02bb\u02bc\u2018\u2019\u0060\u00b4]/g, APOSTROPHE_CLASS);
}

function significantWords(value) {
  return normalize(value)
    .split(/\s+/)
    .filter((word) => word.length > 2);
}

function searchWords(value, lang) {
  const words = significantWords(value);
  if (lang !== 'uz') return words;
  return words.filter((word) => !UZ_BOOK_STOP_WORDS.has(word));
}

function buildSearchVariants(raw, lang) {
  const variants = new Set();
  const input = String(raw || '').trim();
  if (!input) return [];

  const normalized = normalize(input);
  if (input) variants.add(input);
  if (normalized) variants.add(normalized);

  const noApostrophes = normalized.replace(/'/g, '');
  if (noApostrophes && noApostrophes !== normalized) variants.add(noApostrophes);

  if (hasCyrillic(input)) {
    const latin = normalize(cyrillicToLatin(input));
    if (latin) variants.add(latin);
  } else if (lang === 'uz') {
    const cyrillic = normalize(latinToCyrillic(input));
    if (cyrillic && cyrillic !== normalized) variants.add(cyrillic);
  }

  const words = searchWords(input, lang);
  if (words.length > 1) variants.add(words.join(' '));
  if (words.length === 1 && words[0].length >= 5) {
    variants.add(words[0].slice(0, -1));
  }

  return [...variants]
    .map((value) => normalize(value))
    .filter((value, index, arr) => value && arr.indexOf(value) === index)
    .slice(0, 6);
}

function normalizeConfidence(value, fallback = 0.7) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(1, Math.max(0.01, n));
}

function localizedBookPayload(book, lang = 'en') {
  if (!book) return null;
  const isUz = lang === 'uz';
  const title = isUz ? (book.titleUz || book.title) : (book.title || book.titleUz || '');
  const author = isUz ? (book.authorUz || book.author) : (book.author || book.authorUz || '');
  return {
    id: book._id || book.id,
    title,
    titleUz: book.titleUz || null,
    author,
    authorUz: book.authorUz || null,
    language: book.language || null,
    year: book.year || null,
    coverImage: book.coverImage || null,
    affiliateLink: book.affiliateLink || null,
    likes: book.likes || 0
  };
}

function localizeResultByLang(result, lang = 'en') {
  if (!result) return result;
  return {
    ...result,
    confidence: normalizeConfidence(result.confidence, result.source === 'database' ? 0.85 : 0.7),
    book: result.book ? localizedBookPayload(result.book, lang) : null
  };
}

function formatBookResult(book, confidence = 0.88, lang = 'en') {
  return {
    quoteId: `book-${book._id}`,
    text: book.descriptionUz || book.description || '',
    pageNumber: null,
    confidence: normalizeConfidence(confidence, 0.88),
    score: 0,
    book: localizedBookPayload(book, lang),
    source: 'database'
  };
}

function detectTextbookQuery(query) {
  const normalized = normalize(query)
    .replace(/\b(\d{1,2})\s*[-]?\s*(sinf|class|grade)\b/g, '$1 sinf');
  const gradeMatch = normalized.match(/\b([1-9]|1[01])\s*sinf\b/);
  const grade = gradeMatch ? Number(gradeMatch[1]) : null;
  const subjectKey = Object.keys(SUBJECT_ALIASES).find((key) => normalized.includes(key));
  if (!grade || !subjectKey) return null;
  return { grade, subject: subjectKey, terms: SUBJECT_ALIASES[subjectKey] };
}

function localBookRank(book, words, lang) {
  const title = normalize(`${book.titleUz || ''} ${book.title || ''}`);
  const author = normalize(`${book.authorUz || ''} ${book.author || ''}`);
  const description = normalize(`${book.descriptionUz || ''} ${book.description || ''}`);
  let score = 0;

  for (const word of words) {
    if (author.includes(word)) score += 12;
    if (title.includes(word)) score += 8;
    if (description.includes(word)) score += 2;
  }

  score += (book.likes || 0) * 2;
  score += Math.min(10, Math.floor((book.totalQuotes || 0) / 1000));
  if (book.coverImage) score += 4;

  if (lang === 'uz') {
    if (book.language === 'uz') score += 25;
    if (book.titleUz) score += 18;
    if (book.authorUz) score += 12;
    if (/[’ʻʼ‘'`]|[ўқғҳ]/i.test(`${book.titleUz || book.title || ''} ${book.authorUz || book.author || ''}`)) score += 8;

    const titleWords = title.split(/\s+/);
    const englishHints = titleWords.filter((word) => EN_TITLE_HINTS.has(word)).length;
    score -= englishHints * 18;
  }

  return score;
}

function atlasPipeline(query) {
  return [
    {
      $search: {
        index: ATLAS_INDEX,
        text: {
          query,
          path: ['textNormalized', 'text'],
          fuzzy: { maxEdits: 2, prefixLength: 1 }
        }
      }
    },
    { $addFields: { score: { $meta: 'searchScore' } } },
    { $match: { score: { $gte: MIN_SCORE } } },
    { $sort: { score: -1 } },
    { $limit: RESULT_LIMIT },
    {
      $lookup: {
        from: 'books',
        localField: 'bookId',
        foreignField: '_id',
        as: 'book'
      }
    },
    { $unwind: { path: '$book', preserveNullAndEmptyArrays: true } }
  ];
}

/**
 * Normalize an Atlas score (unbounded) into a 0..1 confidence value.
 */
function toConfidence(score) {
  if (!score || score <= 0) return 0;
  const c = score / 10;
  return Math.max(0, Math.min(1, c));
}

/**
 * Fallback search using MongoDB's built-in $text index. Used when Atlas
 * Search is unavailable (local MongoDB) or its index isn't configured yet.
 */
async function textFallback(query) {
  let docs = [];
  try {
    docs = await Quote.find(
      { $text: { $search: query } },
      { score: { $meta: 'textScore' } }
    )
      .sort({ score: { $meta: 'textScore' } })
      .limit(RESULT_LIMIT)
      .lean();
  } catch {
    // $text index not built or not available — fall through to regex.
  }

  // If $text returned nothing, try word-by-word regex on the raw text field.
  if (docs.length === 0) {
    const words = query.split(/\s+/).filter((w) => w.length > 2).slice(0, 6);
    if (words.length > 0) {
      const regexParts = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      // At least half the significant words must match
      const minMatch = Math.max(1, Math.floor(words.length / 2));
      const conditions = regexParts.map((r) => ({
        $or: [
          { textNormalized: { $regex: r, $options: 'i' } },
          { text: { $regex: r, $options: 'i' } }
        ]
      }));
      // Try all-words first, then half-words
      for (const matchCount of [words.length, minMatch]) {
        if (matchCount < 1) continue;
        try {
          docs = await Quote.find({ $and: conditions.slice(0, matchCount) })
            .limit(RESULT_LIMIT)
            .lean();
          if (docs.length > 0) break;
        } catch { break; }
      }
    }
  }

  const bookIds = docs.map((d) => d.bookId).filter(Boolean);
  const books = await Book.find({ _id: { $in: bookIds } }).lean();
  const bookMap = new Map(books.map((b) => [String(b._id), b]));
  return docs.map((d) => ({
    ...d,
    score: d.score || 5,
    book: d.bookId ? bookMap.get(String(d.bookId)) : null
  }));
}

/**
 * Run a single query variant. Tries Atlas $search first. If the Atlas index
 * is missing, some clusters return an empty result instead of throwing, so we
 * also fall back to $text whenever Atlas yields no matches.
 */
async function runVariant(query) {
  if (!query) return [];
  try {
    const atlas = await Quote.aggregate(atlasPipeline(query));
    if (atlas && atlas.length > 0) return atlas;
  } catch (err) {
    // Atlas Search not available - fall through to the $text query below.
  }
  return textFallback(query);
}

/**
 * Last-resort exact substring search on the normalized text. Catches famous
 * phrases made entirely of stop words (e.g. "to be or not to be") that the
 * text index ignores. Slower (no index), so only used when nothing else hits.
 */
async function regexFallback(normalizedPhrase) {
  if (!normalizedPhrase || normalizedPhrase.length < 3) return [];
  const escaped = normalizedPhrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const docs = await Quote.find({
    $or: [
      { textNormalized: { $regex: escaped, $options: 'i' } },
      { text: { $regex: escaped, $options: 'i' } }
    ]
  })
    .limit(RESULT_LIMIT)
    .lean();

  const bookIds = docs.map((d) => d.bookId).filter(Boolean);
  const books = await Book.find({ _id: { $in: bookIds } }).lean();
  const bookMap = new Map(books.map((b) => [String(b._id), b]));
  // Exact substring is a strong match - give it a solid synthetic score.
  return docs.map((d) => ({
    ...d,
    score: 7,
    book: d.bookId ? bookMap.get(String(d.bookId)) : null
  }));
}

/**
 * Search for the book a quote came from.
 *
 * @param {string} input - raw user text (English or Uzbek, Latin or Cyrillic)
 * @param {string} [lang] - optional language hint ('en' | 'uz' | 'ru')
 * @returns {Promise<Array>} top matches with confidence + book info
 */
async function searchQuotes(input, lang) {
  const raw = (input || '').trim();
  if (!raw) return [];

  // Keep stop words: MongoDB/Atlas text analyzers handle them, and removing
  // them ourselves breaks short famous quotes (e.g. "to be or not to be").
  const normalized = normalize(raw);
  if (!normalized) return [];

  // Collect query variants. If Cyrillic, also search the Latin version.
  const variants = new Set([normalized]);
  if (hasCyrillic(raw)) {
    const latin = normalize(cyrillicToLatin(raw));
    if (latin) variants.add(latin);
  }

  let resultsByVariant = await Promise.all([...variants].map((v) => runVariant(v)));

  // If the text/Atlas search found nothing, try exact-substring matching.
  if (resultsByVariant.every((list) => list.length === 0)) {
    resultsByVariant = await Promise.all([...variants].map((v) => regexFallback(v)));
  }

  // Merge variant results, keep the highest score per quote.
  const merged = new Map();
  for (const list of resultsByVariant) {
    for (const doc of list) {
      const id = String(doc._id);
      const existing = merged.get(id);
      if (!existing || (doc.score || 0) > (existing.score || 0)) {
        merged.set(id, doc);
      }
    }
  }

  const items = [...merged.values()];

  // Boost confidence for exact / near-exact substring matches: if any query
  // variant is contained in the quote's normalized text, it's a strong hit.
  const variantList = [...variants];
  for (const doc of items) {
    const haystack = (doc.textNormalized || normalize(doc.text || '')).toLowerCase();
    const exact = variantList.some((v) => v && haystack.includes(v));
    doc._confidence = exact
      ? Math.max(0.9, toConfidence(doc.score))
      : toConfidence(doc.score);
  }

  // Sort by confidence, then by book likes, then by book popularity (totalQuotes as a proxy).
  items.sort((a, b) => {
    const s = (b._confidence || 0) - (a._confidence || 0);
    if (s !== 0) return s;
    const likesA = a.book?.likes || 0;
    const likesB = b.book?.likes || 0;
    if (likesA !== likesB) return likesB - likesA;
    const pa = a.book?.totalQuotes || 0;
    const pb = b.book?.totalQuotes || 0;
    return pb - pa;
  });

  return items.slice(0, RESULT_LIMIT).map((doc) => ({
    quoteId: doc._id,
    text: doc.text,
    textLatin: doc.textLatin || null,
    pageNumber: doc.pageNumber || null,
    chapterTitle: doc.chapterTitle || null,
    language: doc.language,
    confidence: normalizeConfidence(Number((doc._confidence ?? toConfidence(doc.score)).toFixed(3)), 0.8),
    score: doc.score || 0,
    book: doc.book ? localizedBookPayload(doc.book, lang) : null,
    source: 'database'
  }));
}

/**
 * Find books in the database by exact/strong title or author match.
 *
 * Guarantees: if the query is an exact book title (or an exact author name),
 * that book is returned with ~100% confidence so it always lands at the very
 * top of the results, above any AI guesses. Falls back to phrase / all-words
 * matches with progressively lower (but still high) confidence.
 */
async function searchBooks(query, lang = 'en') {
  const normalized = normalize(query);
  if (!normalized) return [];
  const words = searchWords(query, lang);

  // Keep the strongest confidence per book across the staged queries below.
  const ranked = new Map();
  const add = (book, confidence) => {
    if (!book?._id) return;
    const id = String(book._id);
    const existing = ranked.get(id);
    if (!existing || confidence > existing.confidence) {
      ranked.set(id, { book, confidence });
    }
  };

  // 1) Exact full TITLE match — "100% this book".
  const exactTitle = await Book.find({
    $or: [
      { title: { $regex: `^${flexibleRegex(query)}$`, $options: 'i' } },
      { titleUz: { $regex: `^${flexibleRegex(query)}$`, $options: 'i' } }
    ]
  })
    .limit(RESULT_LIMIT)
    .lean();
  exactTitle.forEach((book) => add(book, 1));

  // 2) Exact full AUTHOR match — all of that author's books, guaranteed.
  const exactAuthor = await Book.find({
    $or: [
      { author: { $regex: `^${flexibleRegex(query)}$`, $options: 'i' } },
      { authorUz: { $regex: `^${flexibleRegex(query)}$`, $options: 'i' } }
    ]
  })
    .limit(RESULT_LIMIT)
    .lean();
  exactAuthor.forEach((book) => add(book, 0.99));

  // 3) Title/author CONTAINS the full query phrase (e.g. "navoiy xamsa").
  if (words.length >= 1) {
    const phrase = `\\b${words.map(flexibleRegex).join('\\s+')}\\b`;
    const phraseMatch = await Book.find({
      $or: [
        { title: { $regex: phrase, $options: 'i' } },
        { titleUz: { $regex: phrase, $options: 'i' } },
        { author: { $regex: phrase, $options: 'i' } },
        { authorUz: { $regex: phrase, $options: 'i' } }
      ]
    })
      .limit(RESULT_LIMIT)
      .lean();
    phraseMatch.forEach((book) => add(book, 0.96));
  }

  // 4) Every query word appears somewhere in the title or author (any order).
  if (words.length >= 2) {
    const andConditions = words.slice(0, 5).map((word) => ({
      $or: [
        { title: { $regex: flexibleRegex(word), $options: 'i' } },
        { titleUz: { $regex: flexibleRegex(word), $options: 'i' } },
        { author: { $regex: flexibleRegex(word), $options: 'i' } },
        { authorUz: { $regex: flexibleRegex(word), $options: 'i' } }
      ]
    }));
    const allWords = await Book.find({ $and: andConditions }).limit(RESULT_LIMIT).lean();
    allWords.forEach((book) => add(book, 0.92));
  }

  return [...ranked.values()]
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, RESULT_LIMIT)
    .map(({ book, confidence }) => formatBookResult(book, confidence, lang));
}

async function searchLocalBooks(query, lang = 'en') {
  const words = searchWords(query, lang);
  if (words.length === 0) return [];

  const fields = ['title', 'titleUz', 'author', 'authorUz', 'description', 'descriptionUz'];
  const andConditions = words.slice(0, 4).map((word) => ({
    $or: fields.map((field) => ({ [field]: { $regex: flexibleRegex(word), $options: 'i' } }))
  }));

  const base = lang === 'uz'
    ? { $or: [{ language: 'uz' }, { titleUz: { $exists: true, $ne: '' } }, { authorUz: { $exists: true, $ne: '' } }] }
    : { language: lang };

  const books = await Book.find({ $and: [base, ...andConditions] })
    .limit(60)
    .lean();

  return books
    .sort((a, b) => localBookRank(b, words, lang) - localBookRank(a, words, lang))
    .slice(0, RESULT_LIMIT)
    .map((book) => formatBookResult(book, lang === 'uz' ? 0.92 : 0.86, lang));
}

async function searchTextbooks(query, lang = 'uz') {
  const parsed = detectTextbookQuery(query);
  if (!parsed) return [];

  const gradePatterns = [
    `${parsed.grade}\\s*[-–‑]?\\s*sinf`,
    `${parsed.grade}\\s*[-–‑]?\\s*class`,
    `${parsed.grade}\\s*[-–‑]?\\s*grade`
  ];
  const subjectPatterns = parsed.terms.map(escapeRegex);
  const fields = ['title', 'titleUz', 'description', 'descriptionUz'];

  const gradeOr = fields.flatMap((field) =>
    gradePatterns.map((pattern) => ({ [field]: { $regex: pattern, $options: 'i' } }))
  );
  const subjectOr = fields.flatMap((field) =>
    subjectPatterns.map((pattern) => ({ [field]: { $regex: pattern, $options: 'i' } }))
  );

  let books = await Book.find({
    $and: [
      { $or: [{ language: lang }, { language: 'uz' }, { titleUz: { $exists: true, $ne: '' } }] },
      { $or: gradeOr },
      { $or: subjectOr }
    ]
  })
    .limit(RESULT_LIMIT)
    .lean();

  if (books.length === 0) {
    const title = `${parsed.grade}-sinf ${parsed.terms[0]} darsligi`;
    const book = await getOrCreateAiBook({
      title,
      author: 'O‘zbekiston maktab darsligi',
      year: new Date().getFullYear(),
      description: `${parsed.grade}-sinf o‘quvchilari uchun ${parsed.terms[0]} fani bo‘yicha darslik va qo‘llanmalar.`,
      language: 'uz'
    });
    books = book ? [book] : [];
  }

  return books
    .sort((a, b) => localBookRank(b, searchWords(query, 'uz'), 'uz') - localBookRank(a, searchWords(query, 'uz'), 'uz'))
    .map((book) => formatBookResult(book, 0.96, 'uz'));
}

/**
 * Fetch book cover image from Google Books API
 * Tries multiple query variants to find the best cover
 */
async function fetchBookCover(title, author) {
  if (!GOOGLE_BOOKS_KEY) return null;
  try {
    const cleanTitle = String(title || '').trim();
    const cleanAuthor = String(author || '').trim();
    if (!cleanTitle) return null;

    const queries = [
      `intitle:${cleanTitle}${cleanAuthor ? ` inauthor:${cleanAuthor}` : ''}`,
      `${cleanTitle} ${cleanAuthor}`,
      cleanTitle,
      cleanAuthor ? `${cleanAuthor} ${cleanTitle.split(':')[0]}` : null
    ].filter(Boolean);

    for (const q of queries) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const res = await fetch(
        `${GOOGLE_BOOKS_API}?q=${encodeURIComponent(q)}&maxResults=5&printType=books&key=${GOOGLE_BOOKS_KEY}`,
        { signal: controller.signal }
      );
      clearTimeout(timeoutId);

      if (!res.ok) continue;
      const data = await res.json();
      const items = data.items || [];
      for (const item of items) {
        const links = item?.volumeInfo?.imageLinks || {};
        const img = links.extraLarge || links.large || links.medium || links.small || links.thumbnail || links.smallThumbnail;
        if (img) {
          // Upgrade http to https and remove zoom params for cleaner image
          return img.replace('http:', 'https:').replace(/&zoom=\d/g, '');
        }
      }
    }
    return null;
  } catch (err) {
    console.warn('Failed to fetch book cover:', err.message);
    return null;
  }
}

/**
 * Save a quote returned by AI into the Quote collection for future DB-only serving.
 * Skips silently if the quote already exists for this book.
 */
async function saveAiQuoteForBook(bookId, quoteText, lang) {
  if (!quoteText || !bookId) return;
  try {
    const normalized = normalize(String(quoteText));
    const exists = await Quote.findOne({ bookId, textNormalized: normalized }).lean();
    if (exists) return;
    await Quote.create({
      text: quoteText,
      textNormalized: normalized,
      bookId,
      language: lang || 'en',
      source: 'ai_generated',
      verified: false
    });
  } catch {
    // Ignore duplicate key and other errors silently
  }
}

/**
 * Get or create an AI book in the database so it can be liked
 * Uses upsert to avoid race conditions
 */
async function getOrCreateAiBook(aiBookData) {
  try {
    const title = (aiBookData.title || '').trim();
    const author = (aiBookData.author || '').trim();
    if (!title || !author) return null;

    // Try to find existing book by normalized title + author
    let book = await Book.findOne({
      title: { $regex: `^${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
      author: { $regex: `^${author.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' }
    }).lean();

    if (book) {
      // Update cover image if not set
      if (!book.coverImage && aiBookData.coverImage) {
        await Book.findByIdAndUpdate(book._id, { coverImage: aiBookData.coverImage });
        book.coverImage = aiBookData.coverImage;
      }
      return book;
    }

    book = await Book.create({
      title,
      author,
      year: aiBookData.year || null,
      coverImage: aiBookData.coverImage || null,
      description: aiBookData.description || '',
      language: aiBookData.language || 'en',
      source: 'ai',
      likes: 0,
      likedBy: [],
      affiliateLink: null,
      totalQuotes: 0,
      previewPages: []
    });

    return book.toObject();
  } catch (err) {
    if (err.code === 11000) {
      // Duplicate key - try to find it again
      try {
        return await Book.findOne({ title: aiBookData.title, author: aiBookData.author }).lean();
      } catch {}
    }
    return null;
  }
}

/**
 * AI-powered search using OpenRouter (primary search engine)
 * Uses free AI models from OpenRouter - responds in the user's language
 */
async function aiSearchBooks(query, lang = 'en') {
  if (!ENABLE_AI_SEARCH) return [];

  const apiKey = OPENROUTER_SEARCH_API_KEY;
  if (!apiKey) {
    console.warn('OPENROUTER_SEARCH_API_KEY/OPENROUTER_API_KEY not set, skipping AI search');
    return [];
  }

  const langMap = { uz: "O'zbek", en: 'English', ru: 'Русский' };
  const langName = langMap[lang] || 'English';
  const langInstruction = {
    uz: "JAVOBINGIZNI FAQAT O'ZBEK TILIDA (lotin yozuvida) bering. Avvalo o'zbek, turkiy va Markaziy Osiyo adabiyotidagi kitoblarni toping. Kitob nomi, muallifi va tavsifi o'zbek tilida bo'lsin.",
    en: 'You MUST respond in English. Book title, author, and description must be in English.',
    ru: 'ОТВЕЧАЙТЕ ТОЛЬКО НА РУССКОМ ЯЗЫКЕ. Название книги, автор и описание должны быть на русском.'
  };

  const systemPrompt = `You are a world-class book search engine. The user's query language is: ${langName}.
${langInstruction[lang] || langInstruction.en}

Your task: Given a search query (author name, exact quote, topic, genre, or book title), find at least 20 REAL books.

IMPORTANT RULES:
1. Books MUST be REAL books with REAL authors. NEVER invent or fabricate books.
2. If the query is an AUTHOR NAME, list ALL the famous books BY that author (and if not enough, add books by similar/related authors).
3. If the query is a QUOTE, first identify the EXACT book the quote is from, then suggest similar books.
4. If the query is a TOPIC or GENRE, suggest the best, most popular books in that category.
5. ALWAYS return AT LEAST 20 books. Never return fewer than 20. If one author has fewer books, fill the rest with closely related authors and books on the same theme.
6. Return ONLY a valid JSON array — no markdown blocks, no extra text, no explanation.
7. For multi-word names (e.g. "Abu Ali ibn Sino"), match the full person, not a single word from the name.
8. UZBEK QUERIES: strongly prioritize Uzbek, Turkic, and Central Asian authors first (Alisher Navoiy, Abdulla Qodiriy, Cho'lpon, Abdulla Avloniy, Oybek, G'afur G'ulom, Said Ahmad, O'tkir Hoshimov, Erkin Vohidov, Abdulla Oripov, Tohir Malik, Muhamad Yusuf), then include world classics.

Keep each book object SHORT so you can list all 20 quickly.
REQUIRED JSON fields for each book:
{
  "title": "Book title in query language",
  "author": "Author full name",
  "year": 1965,
  "language": "uz, en, or ru",
  "genre": "Main genre in query language (e.g. Roman, She'riyat, Novel, Falsafa)",
  "description": "1 short sentence",
  "quote": "One real memorable quote from this book",
  "confidence": "high, medium, or low"
}`;

  const userMsg = `Search for books related to: "${query}". Find AT LEAST 20 real books. Respond in ${langName}.`;

  // Only confirmed-working FREE models. We deliberately avoid 'openrouter/auto'
  // here because it can route to a paid model and incur unexpected charges.
  const FREE_MODEL_FALLBACKS = [
    'nvidia/nemotron-3-super-120b-a12b:free',
    'google/gemma-4-31b-it:free',
  ];

  // Deduplicate models to avoid trying the same one twice
  const models = [...new Set([OPENROUTER_SEARCH_MODEL, ...FREE_MODEL_FALLBACKS])];

  for (const [mi, model] of models.entries()) {
    if (isModelCoolingDown(model)) continue; // skip rate-limited model
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 28000); // 28s per model
      const res = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${apiKey}`,
          'HTTP-Referer': process.env.FRONTEND_URL || 'http://localhost:3000',
          'X-Title': 'StatBooks'
        },
        body: JSON.stringify({
          model,
          max_tokens: 4000,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMsg }
          ]
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        const content = data.choices?.[0]?.message?.content || '';

        const parseBooks = (jsonStr) => {
          let books = JSON.parse(jsonStr);
          if (!Array.isArray(books)) books = [books];
          return books;
        };

        let books;
        try {
          books = parseBooks(content);
        } catch {
          const jsonMatch = content.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            try {
              books = parseBooks(jsonMatch[0]);
            } catch {
              continue;
            }
          } else {
            continue;
          }
        }

        // Normalize book objects (handle different field name conventions)
        if (!Array.isArray(books) || books.length === 0) continue;

        const confidenceToNum = { high: 0.9, medium: 0.75, low: 0.6 };
        books = books.map((b) => {
          if (typeof b === 'string') {
            return { title: b, author: 'Unknown', year: null, description: '', isbn: null, confidence: 'medium', quote: '', themes: [], genre: '', pages: null, rating: null, language: lang, titleOriginal: null };
          }
          if (b && typeof b === 'object') {
            return {
              title: b.title || b.name || b.kitob || b.nomi || '',
              titleOriginal: b.titleOriginal || b.original_title || null,
              author: b.author || b.writer || b.muallif || b.yozuvchi || 'Unknown',
              year: b.year || b.yil || null,
              description: b.description || b.desc || b.tavsif || b.about || '',
              isbn: b.isbn || b.ISBN || null,
              confidence: b.confidence || 'medium',
              confidenceNum: confidenceToNum[b.confidence] || 0.75,
              quote: b.quote || b.iqtibos || '',
              themes: Array.isArray(b.themes) ? b.themes : (Array.isArray(b.mavzular) ? b.mavzular : []),
              genre: b.genre || b.janr || '',
              pages: b.pages || b.sahifalar || null,
              rating: b.rating || b.reyting || null,
              language: b.language || lang
            };
          }
          return null;
        }).filter((b) => b && b.title && typeof b.title === 'string' && b.title.trim());

        if (books.length === 0) continue;

        // First save books to DB quickly (parallel), also cache quotes
        const booksInDb = await Promise.all(
          books.slice(0, 25).map(async (book) => {
            try {
              const aiBook = await getOrCreateAiBook({
                title: book.title || '',
                author: book.author || '',
                year: book.year || null,
                description: book.description || '',
                language: book.language || lang
              });
              if (aiBook?._id && book.quote) {
                saveAiQuoteForBook(aiBook._id, book.quote, book.language || lang).catch(() => {});
              }
              return { ...book, dbBook: aiBook };
            } catch {
              return { ...book, dbBook: null };
            }
          })
        );

        // Fetch covers in the BACKGROUND (don't block the response). Fetching a
        // cover hits Google Books with several queries per book, which for ~20
        // books pushes the whole request past its timeout. Instead we return
        // immediately with whatever cover the DB already has, and update the DB
        // in the background so covers appear on the next search.
        booksInDb.forEach((book) => {
          if (!book.dbBook?._id || book.dbBook?.coverImage) return;
          fetchBookCover(book.title, book.author)
            .then((cover) => {
              if (cover) Book.findByIdAndUpdate(book.dbBook._id, { coverImage: cover }).catch(() => {});
            })
            .catch(() => {});
        });

        return booksInDb.map((book, idx) => {
          const coverImage = book.dbBook?.coverImage || null;

          return {
            quoteId: `ai-${Date.now()}-${idx}`,
            text: book.quote || book.description || '',
            pageNumber: null,
            confidence: normalizeConfidence(book.confidenceNum || 0.75, 0.75),
            score: 0,
            book: {
              id: book.dbBook?._id || null,
              title: book.title || '',
              titleOriginal: book.titleOriginal || null,
              titleUz: book.dbBook?.titleUz || null,
              author: book.author || '',
              authorUz: book.dbBook?.authorUz || null,
              language: book.language || lang,
              year: book.year || null,
              isbn: book.isbn || null,
              genre: book.genre || null,
              pages: book.pages || null,
              themes: book.themes || [],
              rating: book.rating || null,
              coverImage,
              affiliateLink: null,
              likes: book.dbBook?.likes || 0
            },
            source: 'ai'
          };
        });
      }

      const errorText = await res.text().catch(() => '');
      if (res.status === 429) {
        setCooldown(model); // don't retry for 60s
      } else {
        console.warn(`AI search model ${model} returned ${res.status}: ${errorText.slice(0, 120)}`);
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.warn(`AI search model ${model} failed:`, err.message);
      }
      continue;
    }
  }

  return [];
}

/**
 * Run a promise with a timeout. If it doesn't settle within ms, resolves to null.
 */
function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve(null), ms))
  ]);
}

function formatQuoteDoc(doc, confidence = null, lang = 'en') {
  return {
    quoteId: doc._id,
    text: doc.text,
    textLatin: doc.textLatin || null,
    pageNumber: doc.pageNumber || null,
    chapterTitle: doc.chapterTitle || null,
    language: doc.language,
    confidence: normalizeConfidence(
      confidence ?? Number((doc._confidence ?? toConfidence(doc.score)).toFixed(3)),
      0.8
    ),
    score: doc.score || 0,
    book: doc.book ? localizedBookPayload(doc.book, lang) : null,
    source: 'database'
  };
}

function resultIdentity(item) {
  const bookId = item?.book?.id ? String(item.book.id) : '';
  if (bookId) return `b:${bookId}`;

  const titleKey = normalize(item?.book?.title || '');
  const authorKey = normalize(item?.book?.author || '');
  if (titleKey || authorKey) return `t:${titleKey}|${authorKey}`;

  const quoteId = item?.quoteId ? String(item.quoteId) : '';
  if (quoteId) return `q:${quoteId}`;
  return null;
}

function mergeByBestResult(items) {
  const merged = new Map();
  for (const item of items) {
    const key = resultIdentity(item);
    if (!key) continue;
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, item);
      continue;
    }

    const currentConfidence = item.confidence || 0;
    const existingConfidence = existing.confidence || 0;
    if (currentConfidence > existingConfidence) {
      merged.set(key, item);
      continue;
    }

    if (
      currentConfidence === existingConfidence &&
      existing.source !== 'database' &&
      item.source === 'database'
    ) {
      merged.set(key, item);
    }
  }
  return [...merged.values()];
}

async function runDatabaseSearchVariant(query, lang, quoteLike) {
  const [bookMatches, quoteMatches, localBooks] = await Promise.all([
    searchBooks(query, lang).catch(() => []),
    quoteLike ? searchQuotes(query, lang).catch(() => []) : Promise.resolve([]),
    searchLocalBooks(query, lang).catch(() => [])
  ]);

  return mergeByBestResult([...bookMatches, ...quoteMatches, ...localBooks]);
}

async function runDatabaseSearchAcrossVariants(variants, lang, quoteLike) {
  const lists = await Promise.all(
    variants.map((variant) => runDatabaseSearchVariant(variant, lang, quoteLike))
  );
  return mergeByBestResult(lists.flat());
}

async function aiExpandSearchVariants(query, lang = 'en') {
  if (!ENABLE_AI_SEARCH) return [];
  const apiKey = OPENROUTER_SEARCH_API_KEY;
  if (!apiKey) return [];

  const models = [
    ...new Set([OPENROUTER_SEARCH_MODEL, 'nvidia/nemotron-3-super-120b-a12b:free', 'google/gemma-4-31b-it:free'])
  ];
  const systemPrompt =
    `Return ONLY JSON: an array of up to 4 short search variants for a books query. ` +
    `Fix typos, transliteration (Uzbek latin/cyrillic), and likely intended phrasing. ` +
    `Do not add explanations. Language: ${lang}.`;

  for (const model of models) {
    if (isModelCoolingDown(model)) continue;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4500);
      const response = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${apiKey}`,
          'HTTP-Referer': process.env.FRONTEND_URL || 'http://localhost:3000',
          'X-Title': 'StatBooks'
        },
        body: JSON.stringify({
          model,
          max_tokens: 180,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Query: "${query}"` }
          ]
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 429) setCooldown(model);
        continue;
      }
      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';
      const rawArray = content.match(/\[[\s\S]*\]/)?.[0] || content;
      const parsed = JSON.parse(rawArray);
      if (!Array.isArray(parsed)) continue;

      return parsed
        .map((value) => normalize(String(value || '')))
        .filter((value, index, arr) => value && arr.indexOf(value) === index)
        .slice(0, 4);
    } catch {
      // Try the next fallback model.
    }
  }

  return [];
}

async function strictDatabaseFallback(raw, lang) {
  const bookResults = await searchBooks(raw, lang);
  if (bookResults.length > 0) return bookResults;

  const quoteLike = raw.length >= 25 || /["'“”‘’.,!?]/.test(raw);
  if (quoteLike) return searchQuotes(raw, lang);

  const exactDocs = await regexFallback(normalize(raw));
  return exactDocs.map((doc) => formatQuoteDoc(doc, 0.9, lang));
}

/**
 * Main search endpoint: combines strong DB matches with AI-assisted discovery.
 * Also uses AI query expansion when user input is typo-heavy.
 * Results are cached in memory for 5 minutes for fast repeat searches.
 */
async function searchQuotesEnhanced(input, lang = 'en') {
  const raw = (input || '').trim();
  if (!raw) return [];
  const effectiveLang = detectLanguage(raw, lang);

  const cacheKey = `${raw.toLowerCase()}:${effectiveLang}`;
  const cached = searchCache.get(cacheKey);
  if (cached && (Date.now() - cached.ts) < CACHE_TTL) {
    return cached.results;
  }

  // Textbook ("9-sinf matematika") queries stay authoritative on their own.
  const textbookResults = await searchTextbooks(raw, effectiveLang);
  if (textbookResults.length > 0) {
    const finalResults = textbookResults.slice(0, RESULT_LIMIT);
    searchCache.set(cacheKey, { ts: Date.now(), results: finalResults });
    return finalResults;
  }

  // Long text or text with punctuation is treated as a quote, so we also
  // search the Quotes collection to find the exact book it came from.
  const quoteLike = raw.length >= 25 || /["'“”‘’.,!?]/.test(raw);
  const baseVariants = buildSearchVariants(raw, effectiveLang);
  const variantPool = new Set(baseVariants);

  // Run DB search across query variants (typo + transliteration resilient).
  let dbResults = await runDatabaseSearchAcrossVariants(baseVariants, effectiveLang, quoteLike);

  // If DB finds nothing, ask AI for better query variants and retry DB once.
  if (dbResults.length === 0) {
    const aiVariants = await withTimeout(aiExpandSearchVariants(raw, effectiveLang), 5500);
    const unseenVariants = (aiVariants || []).filter((variant) => {
      if (!variant) return false;
      if (variantPool.has(variant)) return false;
      variantPool.add(variant);
      return true;
    });

    if (unseenVariants.length > 0) {
      const extraDbResults = await runDatabaseSearchAcrossVariants(
        unseenVariants.slice(0, 3),
        effectiveLang,
        quoteLike
      );
      dbResults = mergeByBestResult([...dbResults, ...extraDbResults]);
    }
  }

  // Always run AI book search (unless DB already has a full page of 20) so the
  // user reliably gets ~20 books even for niche authors the DB doesn't cover.
  const aiResults = (ENABLE_AI_SEARCH && dbResults.length < RESULT_LIMIT)
    ? await withTimeout(aiSearchBooks(raw, effectiveLang), 20000)
    : null;
  const aiList = aiResults && Array.isArray(aiResults) ? aiResults : [];

  // Merge + dedup. Prefer a stable identity per real-world book so the same
  // title coming from both the DB and the AI list collapses into one card.
  const merged = mergeByBestResult([...dbResults, ...aiList]);

  // Rank by match confidence first, then by a "quality" score so the most
  // polished + popular books surface among results of equal confidence.
  merged.sort((a, b) => {
    const c = (b.confidence || 0) - (a.confidence || 0);
    if (Math.abs(c) > 0.001) return c;
    return qualityScore(b, effectiveLang) - qualityScore(a, effectiveLang);
  });

  const finalResults = merged
    .map((item) => localizeResultByLang(item, effectiveLang))
    .slice(0, Math.max(RESULT_LIMIT, 20));
  searchCache.set(cacheKey, { ts: Date.now(), results: finalResults });

  return finalResults;
}

/**
 * A tie-breaker score used to order results of equal confidence. Rewards
 * polished, popular, language-appropriate books (real DB hits over bare AI
 * guesses) without ever overriding the confidence ordering itself.
 */
function qualityScore(result, lang) {
  const book = result.book || {};
  let score = 0;
  if (result.source === 'database') score += 50;
  if (book.language && lang) {
    score += book.language === lang ? 14 : -6;
  }
  if (book.coverImage) score += 30;
  score += Math.min(40, (book.likes || 0) * 4);
  if (lang === 'uz' && (book.titleUz || book.authorUz || book.author)) {
    const text = `${book.titleUz || book.title || ''} ${book.authorUz || book.author || ''}`;
    if (/[’ʻʼ‘'`]|[ўқғҳ]/i.test(text)) score += 12;
  }
  return score;
}

/**
 * Generate exactly 15 key sentences/quotes from a book using OpenRouter AI
 * 5 from beginning, 5 from middle, 5 from end.
 * Returns sentences in the user's language (uz/en/ru).
 */
async function generateBookPreview(title, author, lang = 'en') {
  if (!ENABLE_AI_SEARCH) return [];

  const apiKey = OPENROUTER_SEARCH_API_KEY;
  if (!apiKey) {
    console.warn('OPENROUTER_SEARCH_API_KEY/OPENROUTER_API_KEY not set, skipping AI preview generation');
    return [];
  }

  const langMap = { uz: "O'zbek", en: 'English', ru: 'Русский' };
  const langName = langMap[lang] || 'English';
  const langInstruction = {
    uz: "JAVOBINGIZNI FAQAT O'ZBEK TILIDA (lotin yozuvida) bering. Barcha gaplar o'zbek tilida bo'lsin.",
    en: 'You MUST respond in English. All sentences must be in English.',
    ru: 'ОТВЕЧАЙТЕ ТОЛЬКО НА РУССКОМ ЯЗЫКЕ. Все предложения должны быть на русском.'
  };

  const systemPrompt = `You are a literature expert. For the book "${title}" by "${author}".
${langInstruction[lang] || langInstruction.en}

Your task: Generate exactly 15 REAL key sentences or quotes from this book.
The sentences MUST be divided into three parts:
1. 5 sentences from the BEGINNING of the book
2. 5 sentences from the MIDDLE of the book  
3. 5 sentences from the END of the book

IMPORTANT REQUIREMENTS:
1. Use real sentences/quotes from the actual book. If you don't know the book well, generate plausible sentences in the author's style.
2. Return ONLY a valid JSON array of 15 strings, no markdown code blocks, no extra text.
3. Every sentence should be meaningful, representative, and engaging.
Format: ["Sentence 1", "Sentence 2", ...]`;

  const userMsg = `Generate exactly 15 key sentences/quotes from "${title}" by "${author}" in ${langName} (5 beginning, 5 middle, 5 end).`;

  const FREE_MODEL_FALLBACKS = [
    'nvidia/nemotron-3-super-120b-a12b:free',
    'google/gemma-4-31b-it:free',
  ];

  const models = [...new Set([OPENROUTER_SEARCH_MODEL, ...FREE_MODEL_FALLBACKS])];

  for (const model of models) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 7000);

      const res = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${apiKey}`,
          'HTTP-Referer': process.env.FRONTEND_URL || 'http://localhost:3000',
          'X-Title': 'StatBooks'
        },
        body: JSON.stringify({
          model,
          max_tokens: 2000,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMsg }
          ]
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        const content = data.choices?.[0]?.message?.content || '';
        
        try {
          let sentences = JSON.parse(content.trim());
          if (Array.isArray(sentences) && sentences.length === 15) {
            return sentences;
          }
        } catch {
          const jsonMatch = content.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            try {
              const sentences = JSON.parse(jsonMatch[0].trim());
              if (Array.isArray(sentences) && sentences.length === 15) {
                return sentences;
              }
            } catch {}
          }
        }
      }
    } catch (err) {
      console.warn(`AI preview generation failed with model ${model}:`, err.message);
    }
  }

  return [];
}

module.exports = { searchQuotes, searchBooks, aiSearchBooks, searchQuotesEnhanced, generateBookPreview, toConfidence, ATLAS_INDEX };
