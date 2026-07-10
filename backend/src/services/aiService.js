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
// Primary model from Render env — set to meta-llama/llama-3.3-70b-instruct:free
const OPENROUTER_CHAT_MODEL =
  process.env.OPENROUTER_CHAT_MODEL || process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.3-70b-instruct:free';

// Netlify proxy = 26s limit. 3 models × 7s = 21s max, safe margin.
// Only instruction-tuned models that return real content (NOT reasoning-only models).
// openrouter/free is EXCLUDED — it routes to random models incl. Korean/Chinese
// that ignore language instructions or return content:null.
const FREE_MODEL_FALLBACKS = [
  'meta-llama/llama-3.3-70b-instruct:free',  // best multilingual, great Uzbek
  'google/gemma-4-31b-it:free',              // instruction-tuned, good language follow
  'nvidia/nemotron-3-super-120b-a12b:free',  // fast fallback
];

// find-book: DB does matching, AI just writes 2-3 sentence explanation
const FIND_BOOK_EXPLAIN_MODELS = [
  'meta-llama/llama-3.3-70b-instruct:free',
  'google/gemma-4-31b-it:free',
  'nvidia/nemotron-3-super-120b-a12b:free',
];

function modelCandidates() {
  const list = [OPENROUTER_CHAT_MODEL, ...FREE_MODEL_FALLBACKS];
  return [...new Set(list)].slice(0, 3); // max 3 models × 7s = 21s
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
 * Book Oracle: finds books from DB, uses AI only for a short explanation.
 * No JSON parsing from AI — DB search handles matching, AI just explains.
 * Returns { reply: string, books: Array }
 */
async function findBookForQuestion(question, history = [], dbResults = [], topBooks = [], lang = 'uz') {
  const noBookMsg = {
    uz: "Bu mavzu bo'yicha hozircha mos kitob topilmadi.",
    en: 'No matching book found for this topic yet.',
    ru: 'Подходящая книга по этой теме пока не найдена.'
  };
  const suggestMsg = {
    uz: "Quyidagi kitoblar sizning savolingizga tegishli bo'lishi mumkin:",
    en: 'These books may be helpful for your question:',
    ru: 'Эти книги могут быть полезны для вашего вопроса:'
  };

  // Build matched books from DB search results (reliable, no AI needed)
  const seen = new Set();
  const matchedBooks = [];
  for (const r of dbResults.slice(0, 5)) {
    const b = r.book;
    if (!b) continue;
    const id = String(b.id || b._id || '');
    if (id && seen.has(id)) continue;
    if (id) seen.add(id);
    matchedBooks.push({
      id,
      title: b.title || '',
      author: b.author || '',
      page: r.pageNumber || null,
      reason: '',
      coverImage: b.coverImage || null,
      affiliateLink: b.affiliateLink || null
    });
  }

  // If no keyword matches, fall back to top popular books
  const booksToShow = matchedBooks.length
    ? matchedBooks
    : topBooks.slice(0, 3).map((b) => ({
        id: String(b._id || ''),
        title: b.title || '',
        author: b.author || '',
        page: null,
        reason: '',
        coverImage: b.coverImage || null,
        affiliateLink: b.affiliateLink || null
      })).filter((b) => b.title);

  if (!booksToShow.length) {
    return { reply: noBookMsg[lang] || noBookMsg.en, books: [] };
  }

  // Ask AI for a SHORT plain-text explanation (no JSON, no complex formatting)
  // Any model can write 2 sentences — much more reliable than JSON generation
  const apiKey = process.env.OPENROUTER_CHAT_API_KEY || process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return { reply: suggestMsg[lang] || suggestMsg.en, books: booksToShow };
  }

  const langInstruction = {
    uz: 'Reply in Uzbek (Latin script, 2-3 sentences max).',
    en: 'Reply in English (2-3 sentences max).',
    ru: 'Reply in Russian (2-3 sentences max).'
  };
  const bookTitles = booksToShow.map((b) => `"${b.title}" (${b.author})`).join(', ');
  const systemMsg =
    `You are a helpful librarian. Briefly explain in 2-3 sentences why the book(s) ${bookTitles} ` +
    `are relevant to the user's question. Be warm and encouraging. ` +
    `${langInstruction[lang] || langInstruction.en}`;

  // Instruction-tuned models that return real content (no reasoning-only models)
  const explainCandidates = FIND_BOOK_EXPLAIN_MODELS.slice(0, 2);

  for (const m of explainCandidates) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 8000); // 8s covers headers + body
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
        body: JSON.stringify({
          model: m,
          max_tokens: 150,
          messages: [{ role: 'system', content: systemMsg }, { role: 'user', content: question }]
        }),
        signal: ac.signal
      });
      if (!res.ok) { clearTimeout(timer); continue; }
      data = await res.json();
      clearTimeout(timer);
    } catch { clearTimeout(timer); continue; }

    const reply = (data?.choices?.[0]?.message?.content || '').trim();
    if (reply) return { reply, books: booksToShow };
  }

  // AI failed → return books with a simple default reply (still useful!)
  return { reply: suggestMsg[lang] || suggestMsg.en, books: booksToShow };
}

module.exports = { recommend, context, moodSearch, chat, findBookForQuestion };
