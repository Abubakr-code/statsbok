/**
 * Data ingestion for StatBooks.
 *
 * Two importers:
 *   A) Gutenberg  - via https://gutendex.com (no API key)
 *   B) Google Books - via Google Books API (requires GOOGLE_BOOKS_API_KEY)
 *
 * Run:
 *   npm run ingest:gutenberg          # default ~50 books
 *   npm run ingest:gutenberg -- 100   # custom book count
 *   npm run ingest:google -- "war and peace"
 *
 * Uses Node 18+ built-in global fetch (no extra dependency).
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Book = require('../models/Book');
const Quote = require('../models/Quote');
const { normalize } = require('../utils/textNormalizer');
const { hasCyrillic, cyrillicToLatin } = require('../utils/cyrillicConverter');

const GUTENDEX_URL = 'https://gutendex.com/books/';
const GOOGLE_URL = 'https://www.googleapis.com/books/v1/volumes';

/**
 * Fetch cover image from Google Books API for a given title and author.
 * Returns a URL string or null if not found.
 */
async function fetchBookCover(title, author) {
  try {
    const query = `${title} ${author}`.trim();
    const res = await fetch(
      `${GOOGLE_URL}?q=${encodeURIComponent(query)}&maxResults=1&key=${process.env.GOOGLE_BOOKS_API_KEY}`
    );
    if (!res.ok) return null;
    const data = await res.json();
    const book = data.items?.[0];
    return (
      (book.volumeInfo.imageLinks && (book.volumeInfo.imageLinks.large || book.volumeInfo.imageLinks.medium || book.volumeInfo.imageLinks.thumbnail)) ||
      null
    );
  } catch (err) {
    console.warn('Failed to fetch cover image:', err.message);
    return null;
  }
}

const MIN_LEN = 20;
const MAX_LEN = 300;
// Upper safety cap per book. Set high so almost every real sentence is
// stored - essential for a quote-search product (exact quotes must exist).
const MAX_QUOTES_PER_BOOK = 8000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Remove the Project Gutenberg license/header/footer so quotes come from the
 * actual book content, not boilerplate.
 */
function stripGutenbergBoilerplate(text) {
  let body = text;
  const startRe = /\*\*\*\s*START OF (?:THE|THIS) PROJECT GUTENBERG[^\n]*\*\*\*/i;
  const endRe = /\*\*\*\s*END OF (?:THE|THIS) PROJECT GUTENBERG[^\n]*\*\*\*/i;
  const start = body.match(startRe);
  if (start) body = body.slice(start.index + start[0].length);
  const end = body.match(endRe);
  if (end) body = body.slice(0, end.index);
  return body;
}

/**
 * Pick up to n items evenly spread across an array (so we sample the whole
 * book, not just the first pages / table of contents).
 */
function sampleEvenly(arr, n) {
  if (arr.length <= n) return arr;
  const step = arr.length / n;
  const out = [];
  for (let i = 0; i < n; i += 1) out.push(arr[Math.floor(i * step)]);
  return out;
}

/**
 * Split a large block of text into sentence-like chunks suitable as quotes.
 */
function splitSentences(text) {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\n{2,}/g, ' ')
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/);
}

/**
 * Keep only well-sized sentences (good quote length) and de-duplicate.
 */
function extractQuotes(rawText) {
  const seen = new Set();
  const quotes = [];
  for (const s of splitSentences(rawText)) {
    const sentence = s.trim();
    if (sentence.length < MIN_LEN || sentence.length > MAX_LEN) continue;
    const norm = normalize(sentence);
    if (!norm || seen.has(norm)) continue;
    seen.add(norm);
    quotes.push({ text: sentence, textNormalized: norm });
  }
  return quotes;
}

/**
 * Insert quotes for a book in bulk. Dedupes by textNormalized + bookId using
 * a single query plus one insertMany, which is dramatically faster than a
 * per-quote round-trip (important on remote/Atlas connections).
 */
async function saveQuotes(book, rawQuotes, language, source) {
  const capped = sampleEvenly(rawQuotes, MAX_QUOTES_PER_BOOK);
  if (capped.length === 0) return 0;

  const norms = capped.map((q) => q.textNormalized);
  const existing = await Quote.find(
    { bookId: book._id, textNormalized: { $in: norms } },
    { textNormalized: 1 }
  ).lean();
  const seen = new Set(existing.map((e) => e.textNormalized));

  const docs = [];
  for (const q of capped) {
    if (seen.has(q.textNormalized)) continue;
    seen.add(q.textNormalized);
    const doc = {
      text: q.text,
      textNormalized: q.textNormalized,
      bookId: book._id,
      language,
      source,
      verified: true
    };
    if (hasCyrillic(q.text)) doc.textLatin = cyrillicToLatin(q.text);
    docs.push(doc);
  }

  if (docs.length === 0) return 0;
  await Quote.insertMany(docs, { ordered: false });
  await Book.findByIdAndUpdate(book._id, { $inc: { totalQuotes: docs.length } });
  return docs.length;
}

/* ------------------------------------------------------------------ *
 * A) Gutenberg importer
 * ------------------------------------------------------------------ */

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

/** Pick the best plain-text download link from a gutendex formats object. */
function plainTextUrl(formats) {
  return (
    formats['text/plain; charset=utf-8'] ||
    formats['text/plain; charset=us-ascii'] ||
    formats['text/plain'] ||
    null
  );
}

async function importGutenberg(targetBooks = 50) {
  console.log(`Gutenberg import starting (target ~${targetBooks} books)...`);
  let url = `${GUTENDEX_URL}?languages=en`;
  let processed = 0;
  let totalQuotes = 0;

  while (url && processed < targetBooks) {
    let page;
    try {
      page = await fetchJson(url);
    } catch (err) {
      console.warn('Failed to fetch gutendex page, retrying once:', err.message);
      await sleep(2000);
      try {
        page = await fetchJson(url);
      } catch (err2) {
        console.error('Giving up on this page:', err2.message);
        break;
      }
    }

    for (const item of page.results || []) {
      if (processed >= targetBooks) break;

      const txtUrl = plainTextUrl(item.formats || {});
      if (!txtUrl) continue;

      const gutenbergId = String(item.id);
      const cover =
        (item.formats && (item.formats['image/jpeg'] || item.formats['image/png'])) ||
        `https://www.gutenberg.org/cache/epub/${gutenbergId}/pg${gutenbergId}.cover.medium.jpg`;
      let book = await Book.findOne({ gutenbergId });
      if (!book) {
        book = await Book.create({
          title: item.title || 'Unknown',
          author: (item.authors && item.authors[0] && item.authors[0].name) || 'Unknown',
          year: null,
          coverImage: cover,
          language: 'en',
          gutenbergId,
          source: 'gutenberg'
        });
      } else if (!book.coverImage) {
        book.coverImage = cover;
        await book.save();
      }

      try {
        const text = await fetchText(txtUrl);
        const quotes = extractQuotes(stripGutenbergBoilerplate(text));
        const inserted = await saveQuotes(book, quotes, 'en', 'gutenberg');
        totalQuotes += inserted;
        processed += 1;
        console.log(`[${processed}] ${book.title} -> +${inserted} quotes (total ${totalQuotes})`);
      } catch (err) {
        console.warn(`Skipping book ${gutenbergId}: ${err.message}`);
      }

      // be polite to the servers
      await sleep(500);
    }

    url = page.next || null;
  }

  console.log(`Gutenberg import done. Books: ${processed}, quotes added: ${totalQuotes}`);
}

/* ------------------------------------------------------------------ *
 * B) Google Books importer
 * ------------------------------------------------------------------ */

async function importGoogleBooks(query) {
  const key = process.env.GOOGLE_BOOKS_API_KEY;
  if (!key) throw new Error('GOOGLE_BOOKS_API_KEY is not set in .env');
  if (!query) throw new Error('Provide a search query, e.g. ingest:google -- "war and peace"');

  console.log(`Google Books import for: "${query}"`);
  const url = `${GOOGLE_URL}?q=${encodeURIComponent(query)}&maxResults=20&key=${key}`;
  const data = await fetchJson(url);

  let booksAdded = 0;
  let quotesAdded = 0;

  for (const item of data.items || []) {
    const info = item.volumeInfo || {};
    const googleBooksId = item.id;

    let book = await Book.findOne({ googleBooksId });
    if (!book) {
      book = await Book.create({
        title: info.title || 'Unknown',
        author: (info.authors && info.authors[0]) || 'Unknown',
        year: info.publishedDate ? parseInt(info.publishedDate.slice(0, 4), 10) || null : null,
// Muqova rasmini yaxshiroq tanlab olamiz: katta rasm (large/medium) mavjud bo'lsa, uni ishlatamiz;
// aks holda thumbnail yoki placeholder tasvir.
        coverImage: (info.imageLinks && (info.imageLinks.large || info.imageLinks.medium || info.imageLinks.thumbnail)) || 'https://via.placeholder.com/128x192?text=No+Cover',
        description: info.description || '',
        language: info.language === 'uz' || info.language === 'ru' ? info.language : 'en',
        googleBooksId,
        affiliateLink: info.infoLink || (item.saleInfo && item.saleInfo.buyLink) || null,
        source: 'google_books'
      });
      booksAdded += 1;
    }

    // Use the text snippet / description as preview/quote material.
    const snippet =
      (item.searchInfo && item.searchInfo.textSnippet) || info.description || '';
    if (snippet) {
      const quotes = extractQuotes(snippet);
      const lang = book.language || 'en';
      quotesAdded += await saveQuotes(book, quotes, lang, 'google_books');
      if (!book.previewPages || book.previewPages.length === 0) {
        book.previewPages = [snippet.slice(0, 1500)];
        await book.save();
      }
    }
  }

  console.log(`Google Books done. New books: ${booksAdded}, quotes added: ${quotesAdded}`);
}

/* ------------------------------------------------------------------ *
 * CLI entry point
 * ------------------------------------------------------------------ */

async function main() {
  const mode = process.argv[2];
  const arg = process.argv[3];

  if (!mode) {
    console.log('Usage: node src/services/ingestionService.js <gutenberg|google> [arg]');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  try {
    if (mode === 'gutenberg') {
      const target = arg ? parseInt(arg, 10) : 50;
      await importGutenberg(target);
    } else if (mode === 'google') {
      await importGoogleBooks(arg);
    } else {
      console.error('Unknown mode:', mode);
    }
  } catch (err) {
    console.error('Ingestion failed:', err.message);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected. Done.');
  }
}

// Run only when executed directly (not when required by tests).
if (require.main === module) {
  main();
}

module.exports = { importGutenberg, importGoogleBooks, extractQuotes, saveQuotes };
