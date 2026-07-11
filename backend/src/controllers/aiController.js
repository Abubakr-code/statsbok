const ai = require('../services/aiService');
const Quote = require('../models/Quote');
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
    const isAiDown = /unavailable|OpenRouter|OPENROUTER_API_KEY/i.test(err.message);
    if (isAiDown) return res.status(503).json({ error: 'ai_unavailable', message: err.message });
    next(err);
  }
}

async function findBook(req, res, next) {
  try {
    const { question, messages, lang } = req.body;
    const q = question || (Array.isArray(messages) && messages.length ? messages[messages.length - 1].content : '');
    if (!q || !String(q).trim()) return res.status(400).json({ error: 'question is required' });

    const resolvedLang = lang || 'uz';

    // Fast simple DB quote search — 3s max, no AI, just context for the Oracle
    const words = String(q).trim().split(/\s+/).filter((w) => w.length > 3).slice(0, 4);
    const dbResultsPromise = words.length > 0
      ? Quote.find({ $or: words.map((w) => ({ textNormalized: { $regex: w, $options: 'i' } })) })
          .limit(6).populate('bookId').lean()
          .then((docs) => docs.map((d) => ({ book: d.bookId, text: d.text, pageNumber: d.page })))
          .catch(() => [])
      : Promise.resolve([]);

    const [dbResults] = await Promise.all([dbResultsPromise]);

    const result = await ai.findBookForQuestion(q, messages || [], dbResults, [], resolvedLang);
    res.json(result);
  } catch (err) {
    return res.status(503).json({ reply: err.message, books: [] });
  }
}

module.exports = { recommend, context, moodSearch, chat, findBook };
