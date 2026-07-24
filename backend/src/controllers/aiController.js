const ai = require('../services/aiService');
const { strictAiSearch } = require('../services/strictAiSearchService');

function oracleReply(result, lang) {
  const first = result.results?.[0];
  if (!first) {
    const messages = {
      uz: "Bu manbani yetarli ishonch bilan aniqlay olmadim. Taxminiy yoki uydirma kitob ko'rsatmayman — iqtibosni to'liqroq yuboring.",
      ru: 'Не удалось определить источник с достаточной уверенностью. Я не буду показывать случайную или выдуманную книгу — пришлите цитату полностью.',
      en: 'I could not identify the source with enough confidence. I will not show a random or invented book—please send a longer quote.'
    };
    return messages[lang] || messages.uz;
  }

  const title = first.book?.title || '';
  const author = first.book?.author || '';
  const confidence = Math.round((first.confidence || 0) * 100);
  const messages = {
    uz: `Ikki bosqichli AI tekshiruvi bo'yicha eng aniq manba: **${title}** — ${author}. Ishonch darajasi: ${confidence}%.`,
    ru: `По результатам двухэтапной проверки AI наиболее точный источник: **${title}** — ${author}. Уверенность: ${confidence}%.`,
    en: `After two-stage AI verification, the most likely source is **${title}** by ${author}. Confidence: ${confidence}%.`
  };
  return messages[lang] || messages.uz;
}

async function recommend(req, res, next) {
  try {
    const { quote, lang } = req.body;
    if (!quote) return res.status(400).json({ error: 'quote is required' });
    res.json({ recommendation: await ai.recommend(quote, lang) });
  } catch (err) { next(err); }
}

async function context(req, res, next) {
  try {
    const { quote, bookTitle, lang } = req.body;
    if (!quote) return res.status(400).json({ error: 'quote is required' });
    res.json({ context: await ai.context(quote, bookTitle, lang) });
  } catch (err) { next(err); }
}

async function moodSearch(req, res, next) {
  try {
    const { mood, lang } = req.body;
    if (!mood) return res.status(400).json({ error: 'mood is required' });
    res.json({ suggestions: await ai.moodSearch(mood, lang) });
  } catch (err) { next(err); }
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

// Book Oracle — strict two-stage AI verification, no database lookup.
async function findBook(req, res, next) {
  try {
    const { question, messages, lang } = req.body;
    const q = question || (Array.isArray(messages) && messages.length
      ? messages[messages.length - 1].content : '');
    if (!q || !String(q).trim()) return res.status(400).json({ error: 'question is required' });

    const safeLang = ['uz', 'ru', 'en'].includes(lang) ? lang : 'uz';
    const result = await strictAiSearch(q, safeLang);
    const books = (result.results || []).map((item) => ({
      id: null,
      title: item.book?.title || '',
      author: item.book?.author || '',
      page: null,
      reason: item.text || '',
      coverImage: null,
      affiliateLink: null,
      confidence: item.confidence
    }));
    res.json({
      reply: oracleReply(result, safeLang),
      books,
      status: result.status,
      intent: result.intent
    });
  } catch (err) {
    return res.status(503).json({ reply: err.message, books: [] });
  }
}

module.exports = { recommend, context, moodSearch, chat, findBook };
