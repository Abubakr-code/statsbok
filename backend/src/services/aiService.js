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
  process.env.OPENROUTER_CHAT_MODEL || process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.3-70b-instruct:free';

// Groq — free alternative API (30 req/min free, very fast)
// Get key at https://console.groq.com → set GROQ_API_KEY in Render
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODELS = [
  'llama-3.3-70b-versatile',   // best multilingual
  'llama-3.1-8b-instant',      // ultra-fast fallback
];

// OpenRouter free model list — try these in order
const FREE_MODEL_FALLBACKS = [
  'meta-llama/llama-3.3-70b-instruct:free',
  'meta-llama/llama-3.2-3b-instruct:free',
  'mistralai/mistral-7b-instruct:free',
];

// find-book: 2 models × 7s = 14s max (fast path, Groq fallback after)
const FIND_BOOK_EXPLAIN_MODELS = [
  'meta-llama/llama-3.3-70b-instruct:free',
  'mistralai/mistral-7b-instruct:free',
];

function modelCandidates() {
  const list = [OPENROUTER_CHAT_MODEL, ...FREE_MODEL_FALLBACKS];
  return [...new Set(list)].slice(0, 3);
}

/**
 * Try Groq API as fallback when OpenRouter fails.
 * Returns reply string or null if Groq also fails.
 */
async function tryGroq(payloadMessages, timeoutMs = 8000) {
  if (!GROQ_API_KEY) return null;
  for (const model of GROQ_MODELS) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    let data;
    try {
      const res = await fetch(GROQ_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${GROQ_API_KEY}`,
        },
        body: JSON.stringify({ model, max_tokens: 400, messages: payloadMessages }),
        signal: ac.signal
      });
      if (!res.ok) { clearTimeout(timer); continue; }
      data = await res.json();
      clearTimeout(timer);
    } catch { clearTimeout(timer); continue; }
    const reply = (data?.choices?.[0]?.message?.content || '').trim();
    if (reply) return reply;
  }
  return null;
}

function bookAssistantSystemPrompt(lang) {
  const langMap = { uz: 'Uzbek (Latin script)', ru: 'Russian', en: 'English' };
  const replyLangName = langMap[lang] || 'Uzbek (Latin script)';
  return (
    'You are "StatBooks AI" 📚 — a warm, enthusiastic book companion inside the StatBooks app. ' +
    'You are passionate about literature, quotes, and helping people fall in love with reading. ' +
    'Your personality: friendly, encouraging, a little playful, always uplifting. ' +
    '\n\nYou help users: discover great books, understand quotes and their context, ' +
    'get personalized reading recommendations, learn about authors and literary themes. ' +
    'If asked something unrelated to books, gently and warmly steer the conversation back to reading. ' +
    '\n\nFormatting rules:\n' +
    '- Use **bold** for book titles and author names\n' +
    '- Use 2-4 relevant emojis per reply (📖 ✨ 💡 🌟 🎯 💭 🔥 👏 🌹)\n' +
    '- Keep replies concise: 2-5 sentences OR a short bullet list (max 4 items)\n' +
    '- Start replies with a warm opener or emoji when appropriate\n' +
    '- Never use technical jargon\n' +
    `\nCRITICAL LANGUAGE RULE: You MUST reply ONLY in ${replyLangName}. ` +
    `Never switch to English or any other language regardless of what the user writes.`
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
  // Use UI language directly — don't override with detectLanguage.
  // The system prompt already enforces the reply language strictly.
  const payloadMessages = [
    { role: 'system', content: bookAssistantSystemPrompt(lang) },
    ...trimmed
  ];

  let lastError = 'No model available';
  for (const model of modelCandidates()) {
    // Timer covers the ENTIRE request (headers + body).
    // clearTimeout only after res.json() so slow body reads are also aborted.
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 7000); // 7s hard limit per model
    let data;
    try {
      const res = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${apiKey}`,
          'HTTP-Referer': process.env.FRONTEND_URL || 'http://localhost:3000',
          'X-Title': 'StatBooks'
        },
        body: JSON.stringify({ model, max_tokens: 400, messages: payloadMessages }),
        signal: ac.signal
      });
      if (!res.ok) { clearTimeout(timer); lastError = `OpenRouter ${res.status}`; continue; }
      data = await res.json(); // timer still active — aborts if body is slow
      clearTimeout(timer);
    } catch (err) {
      clearTimeout(timer);
      lastError = err.name === 'AbortError' ? `${model} timeout` : err.message;
      continue;
    }

    // NEVER use reasoning/thinking tokens — they are the model's internal thoughts.
    const reply = (data.choices?.[0]?.message?.content || '').trim();
    if (reply) return reply;
    lastError = 'content:null (reasoning-only model, skipping)';
  }

  // OpenRouter failed — try Groq as fallback (different provider, different limits)
  const groqReply = await tryGroq(payloadMessages);
  if (groqReply) return groqReply;

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

/**
 * Book Oracle: AI identifies the book/source for ANY quote or question
 * using its own training knowledge — NOT limited to the database.
 * DB results are provided as extra context if available.
 * Returns { reply: string, books: Array }
 */
async function findBookForQuestion(question, history = [], dbResults = [], topBooks = [], lang = 'uz') {
  const apiKey = process.env.OPENROUTER_CHAT_API_KEY || process.env.OPENROUTER_API_KEY;

  const langMap = {
    uz: 'Uzbek (Latin script)',
    ru: 'Russian',
    en: 'English'
  };
  const replyLang = langMap[lang] || 'Uzbek (Latin script)';

  // Provide DB books as extra context so AI can reference them if relevant
  const dbContext = dbResults.slice(0, 6).map((r) => {
    const b = r.book;
    return b ? `"${b.title}" by ${b.author}` : null;
  }).filter(Boolean).join('; ');

  const systemPrompt =
    `You are "StatBooks Oracle" — an expert literary assistant who identifies books from quotes and topics.\n` +
    `CRITICAL: Reply ONLY in ${replyLang}. Never switch to English or any other language.\n\n` +
    `When the user sends a QUOTE: identify which book it is from, who wrote it, and briefly why it is significant.\n` +
    `When the user sends a TOPIC/QUESTION: recommend 1-2 specific real books that best cover that topic.\n\n` +
    `Format your reply as plain conversational text (2-4 sentences). Mention the book title in **bold** and author name.\n` +
    `If you genuinely do not know the source of a quote, say so honestly — do NOT invent a title.\n` +
    (dbContext ? `\nBooks available in our library for reference: ${dbContext}\n` : '');

  const historySlice = (history || []).slice(-4).map((m) => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: String(m.content || '').slice(0, 600)
  }));

  const messages = [
    { role: 'system', content: systemPrompt },
    ...historySlice,
    { role: 'user', content: question }
  ];

  // 2 models × 7s = 14s + Groq fallback 7s = 21s total (under Netlify 26s)
  const candidates = FIND_BOOK_EXPLAIN_MODELS.slice(0, 2);

  for (const m of candidates) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 7000);
    let data;
    try {
      const res = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${apiKey}`,
          'HTTP-Referer': process.env.FRONTEND_URL || 'http://localhost:3000',
          'X-Title': 'StatBooks'
        },
        body: JSON.stringify({ model: m, max_tokens: 300, messages }),
        signal: ac.signal
      });
      if (!res.ok) { clearTimeout(timer); continue; }
      data = await res.json();
      clearTimeout(timer);
    } catch { clearTimeout(timer); continue; }

    const reply = (data?.choices?.[0]?.message?.content || '').trim();
    if (!reply) continue;

    // Also return any DB books that match — as additional links the user can open
    const dbBooks = dbResults.slice(0, 3).map((r) => {
      const b = r.book;
      if (!b) return null;
      return {
        id: String(b.id || b._id || ''),
        title: b.title || '',
        author: b.author || '',
        page: r.pageNumber || null,
        reason: '',
        coverImage: b.coverImage || null,
        affiliateLink: b.affiliateLink || null
      };
    }).filter((b) => b && b.title);

    return { reply, books: dbBooks };
  }

  // OpenRouter failed — try Groq as fallback
  const groqReply = await tryGroq(messages, 8000);
  if (groqReply) {
    const dbBooks = dbResults.slice(0, 3).map((r) => {
      const b = r.book;
      if (!b) return null;
      return {
        id: String(b.id || b._id || ''),
        title: b.title || '',
        author: b.author || '',
        page: r.pageNumber || null,
        reason: '',
        coverImage: b.coverImage || null,
        affiliateLink: b.affiliateLink || null
      };
    }).filter((b) => b && b.title);
    return { reply: groqReply, books: dbBooks };
  }

  const errMsg = {
    uz: 'AI hozir javob bera olmadi. Birozdan so\'ng urinib ko\'ring.',
    ru: 'AI сейчас не может ответить. Попробуйте чуть позже.',
    en: 'AI is unavailable right now. Please try again shortly.'
  };
  throw new Error(errMsg[lang] || errMsg.uz);
}

module.exports = { recommend, context, moodSearch, chat, findBookForQuestion };
