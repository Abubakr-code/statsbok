const ai = require('../services/aiService');

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

module.exports = { recommend, context, moodSearch, chat };
