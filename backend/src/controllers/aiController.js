const ai = require('../services/aiService');
const { searchQuotesEnhanced } = require('../services/searchService');
const Book = require('../models/Book');

async function recommend(req, res, next) {
  try {
    const { quote, lang } = req.body;
    if (!quote) return res.status(400).json({ error: 'quote is required' });
    res.json({ recommendation: await ai.recommend(quote, lang) });
  } catch (err) {
    next(err);
  }
}

async function context(req, res, next) {
  try {
    const { quote, bookTitle, lang } = req.body;
    if (!quote) return res.status(400).json({ error: 'quote is required' });
    res.json({ context: await ai.context(quote, bookTitle, lang) });
  } catch (err) {
    next(err);
  }
}

async function moodSearch(req, res, next) {
  try {
    const { mood, lang } = req.body;
    if (!mood) return res.status(400).json({ error: 'mood is required' });
    res.json({ suggestions: await ai.moodSearch(mood, lang) });
  } catch (err) {
    next(err);
  }
}

async function chat(req, res, next) {
  try {
    const { messages, lang } = req.body;
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages array is required' });
    }
    const reply = await ai.chat(messages, lang);
    res.json({ reply });
  } catch (err) {
    next(err);
  }
}

async function findBook(req, res, next) {
  try {
    const { question, messages, lang } = req.body;
    const q = question || (Array.isArray(messages) && messages.length ? messages[messages.length - 1].content : '');
    if (!q || !String(q).trim()) return res.status(400).json({ error: 'question is required' });

    const resolvedLang = lang || 'uz';
    const [dbResults, topBooks] = await Promise.all([
      searchQuotesEnhanced(q, resolvedLang).catch(() => []),
      Book.find({}).sort({ likes: -1, totalQuotes: -1 }).limit(40).lean().catch(() => [])
    ]);

    const result = await ai.findBookForQuestion(q, messages || [], dbResults, topBooks, resolvedLang);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = { recommend, context, moodSearch, chat, findBook };
