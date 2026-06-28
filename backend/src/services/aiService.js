/**
 * Claude AI integration (model claude-haiku-3-5 for cost efficiency).
 * Uses the Anthropic Messages API via built-in fetch (Node 18+).
 */

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
// Anthropic API model id (alias). "claude-haiku-3-5" is NOT a valid id and
// would return a 404 from the API; the correct alias is below.
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-3-5-haiku-latest';
const MAX_TOKENS = 500;

async function callClaude(system, userContent, maxTokens = MAX_TOKENS) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set');

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 20000);
  let res;
  try {
    res = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      signal: ac.signal,
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: maxTokens,
        system,
        messages: [{ role: 'user', content: userContent }]
      })
    });
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Claude API error ${res.status}: ${detail}`);
  }

  const data = await res.json();
  return (data.content && data.content[0] && data.content[0].text) || '';
}

function langName(lang) {
  return lang === 'uz' ? 'Uzbek' : lang === 'ru' ? 'Russian' : 'English';
}

/* ===== OpenRouter chat (free models) =====
 * Powers the floating AI assistant. OpenRouter offers free models, so the
 * book chat costs nothing. Get a key at https://openrouter.ai and set
 * OPENROUTER_CHAT_API_KEY (or OPENROUTER_API_KEY). Pick model via
 * OPENROUTER_CHAT_MODEL. */

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_CHAT_API_KEY = process.env.OPENROUTER_CHAT_API_KEY || process.env.OPENROUTER_API_KEY;
const OPENROUTER_CHAT_MODEL =
  process.env.OPENROUTER_CHAT_MODEL || process.env.OPENROUTER_MODEL || 'nvidia/nemotron-3-super-120b-a12b:free';
const { detectLanguage } = require('../utils/languageDetector');

// Free models are popular and get rate-limited (429) upstream. We try several
// (from different providers) in order so the chat stays responsive when one
// is busy or unavailable.
// Only confirmed-working FREE models. We deliberately avoid 'openrouter/auto'
// because it can route to a PAID model and incur charges. Everything here is free.
const FREE_MODEL_FALLBACKS = [
  'google/gemma-4-31b-it:free',
  'nvidia/nemotron-3-super-120b-a12b:free',
];

function modelCandidates() {
  const list = [OPENROUTER_CHAT_MODEL, ...FREE_MODEL_FALLBACKS];
  return [...new Set(list)];
}

function bookAssistantSystemPrompt(lang) {
  return (
    'You are "StatBooks AI", a warm, knowledgeable book companion inside the ' +
    'StatBooks app (a tool that identifies which book a quote comes from). ' +
    'You love literature and quotes. Help users discover books, explain the ' +
    'meaning and context of quotes, recommend what to read next, and discuss ' +
    'authors and themes. Be friendly, concise, and encouraging. If asked ' +
    'something unrelated to books or reading, gently steer back to books. ' +
    'Formatting: keep replies short (2-5 sentences or a short bullet list). ' +
    'Use **bold** for book titles and author names. Add 1-2 tasteful, ' +
    'relevant emoji to feel warm and expressive (e.g. 📖, ✨, 💡), but never ' +
    'overuse them. ' +
    `Always reply in ${langName(lang)}. The interface language may be different; follow the user's message language.`
  );
}

/**
 * Multi-turn chat for the assistant widget.
 * @param {Array<{role:'user'|'assistant', content:string}>} messages
 * @param {string} lang
 */
async function chat(messages, lang = 'en') {
  const apiKey = OPENROUTER_CHAT_API_KEY;
  if (!apiKey) {
    const noKey = {
      uz: 'Kechirasiz, AI yordamchi hozir mavjud emas. Keyinroq urinib ko\'ring.',
      ru: 'Извините, AI-помощник сейчас недоступен. Попробуйте позже.',
      en: 'Sorry, the AI assistant is currently unavailable. Please try again later.'
    };
    return noKey[lang] || noKey.en;
  }

  const trimmed = (messages || []).slice(-10).map((m) => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: String(m.content || '').slice(0, 2000)
  }));
  const lastUser = [...trimmed].reverse().find((m) => m.role === 'user');
  const replyLang = detectLanguage(lastUser?.content || '', lang);
  const payloadMessages = [
    { role: 'system', content: bookAssistantSystemPrompt(replyLang) },
    ...trimmed
  ];

  let lastError = 'No model available';
  for (const model of modelCandidates()) {
    let res;
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 18000); // 18s per model
    try {
      res = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${apiKey}`,
          'HTTP-Referer': process.env.FRONTEND_URL || 'http://localhost:3000',
          'X-Title': 'StatBooks'
        },
        body: JSON.stringify({ model, max_tokens: 500, messages: payloadMessages }),
        signal: ac.signal
      });
    } catch (err) {
      clearTimeout(timer);
      lastError = err.name === 'AbortError' ? `${model} timeout` : err.message;
      continue;
    }
    clearTimeout(timer);

    if (res.ok) {
      const data = await res.json();
      const reply = data.choices?.[0]?.message?.content;
      if (reply) return reply;
      lastError = 'Empty response';
      continue;
    }

    // Any error (429 rate-limit, 404 model gone, 5xx): try the next model.
    lastError = `OpenRouter ${res.status}`;
  }

  throw new Error(`OpenRouter: all models unavailable (${lastError})`);
}

async function recommend(quoteText, lang = 'en') {
  const system =
    'You are a knowledgeable librarian. Given a quote the user enjoyed, ' +
    `recommend 3 books they might like. Be concise. Reply in ${langName(lang)}.`;
  return callClaude(system, `I liked this quote: "${quoteText}". What should I read next?`);
}

async function context(quoteText, bookTitle, lang = 'en') {
  const system =
    'You explain literary context briefly and accurately. If unsure, say so. ' +
    `Reply in ${langName(lang)}.`;
  const prompt = bookTitle
    ? `In the book "${bookTitle}", what happens around this quote: "${quoteText}"?`
    : `What is the likely context of this quote: "${quoteText}"?`;
  return callClaude(system, prompt);
}

async function moodSearch(mood, lang = 'en') {
  const system =
    'You suggest books and quote themes matching a mood. Return 3 concise suggestions. ' +
    `Reply in ${langName(lang)}.`;
  return callClaude(system, `I want something about: ${mood}`);
}

module.exports = { recommend, context, moodSearch, chat };
