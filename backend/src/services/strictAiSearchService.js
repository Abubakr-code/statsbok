const crypto = require('crypto');

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const NVIDIA_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const OPENROUTER_API_KEY =
  process.env.OPENROUTER_CHAT_API_KEY ||
  process.env.OPENROUTER_SEARCH_API_KEY ||
  process.env.OPENROUTER_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY;

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash';
const GEMINI_ENABLE_SEARCH = String(process.env.GEMINI_ENABLE_SEARCH || '').toLowerCase() === 'true';
const NVIDIA_MODEL = process.env.NVIDIA_MODEL || 'meta/llama-3.1-70b-instruct';
const GROQ_PRIMARY_MODEL = process.env.GROQ_SEARCH_MODEL || 'llama-3.3-70b-versatile';
const GROQ_VERIFY_MODEL = process.env.GROQ_VERIFY_MODEL || 'llama-3.3-70b-versatile';
const configuredOpenRouterModel =
  process.env.OPENROUTER_SEARCH_MODEL ||
  process.env.OPENROUTER_MODEL ||
  'google/gemma-4-31b-it:free';
const REMOVED_OPENROUTER_MODELS = new Set([
  'openrouter/free',
  'deepseek/deepseek-chat-v3-0324:free',
  'meta-llama/llama-3.3-70b-instruct:free'
]);
const OPENROUTER_MODEL = REMOVED_OPENROUTER_MODELS.has(configuredOpenRouterModel)
  ? 'google/gemma-4-31b-it:free'
  : configuredOpenRouterModel;

const VALID_INTENTS = new Set(['quote', 'author', 'title', 'topic']);
const VALID_LANGS = new Set(['uz', 'ru', 'en']);
const MAX_RESULTS = 5;

function cleanJson(content) {
  const text = String(content || '').trim();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    const object = text.match(/\{[\s\S]*\}/);
    if (!object) return null;
    try {
      return JSON.parse(object[0]);
    } catch {
      return null;
    }
  }
}

function normalizeKey(value) {
  return String(value || '')
    .toLocaleLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\u0400-\u04ff]+/gi, ' ')
    .trim();
}

function normalizeWorkTitle(value) {
  return normalizeKey(value)
    .replace(/\b(dostoni|doston|she ri|poem|poema|roman|novel|kitobi|asari|поэма|роман|стихотворение)\b$/i, '')
    .trim();
}

function sameBook(a, b) {
  if (!a || !b) return false;
  return (
    normalizeWorkTitle(a.title) === normalizeWorkTitle(b.title) &&
    normalizeKey(a.author) === normalizeKey(b.author)
  );
}

function hintIntent(query) {
  const text = String(query || '').trim();
  const words = text.split(/\s+/).filter(Boolean);
  const topicSignals =
    /\b(haqida|mavzu|tavsiya|tavsiye|kitob|asar|janr|tarix|she['’]?rlar?|about|recommend|books?|topic|genre|книг|про|тема|жанр|посовет)\b/i;
  const explicitQuote = /["“”«»]/.test(text);
  if (explicitQuote || (words.length >= 4 && !topicSignals.test(text))) return 'quote';
  return 'unknown';
}

function languageName(lang) {
  if (lang === 'ru') return 'Russian';
  if (lang === 'en') return 'English';
  return 'Uzbek (Latin script)';
}

function normalizeCandidate(raw, lang) {
  if (!raw || typeof raw !== 'object') return null;
  const title = String(raw.title || '').trim();
  const author = String(raw.author || '').trim();
  const unknown = /^(unknown|noma['’]?lum|неизвест)/i;
  if (!title || !author || unknown.test(title) || unknown.test(author)) {
    return null;
  }

  const confidence = Math.max(0, Math.min(1, Number(raw.confidence) || 0));
  return {
    title,
    author,
    year:
      raw.year !== null &&
      raw.year !== undefined &&
      raw.year !== '' &&
      Number.isFinite(Number(raw.year))
        ? Number(raw.year)
        : null,
    language: VALID_LANGS.has(raw.language) ? raw.language : lang,
    genre: String(raw.genre || '').trim(),
    reason: String(raw.reason || '').trim(),
    confidence
  };
}

function normalizeDiscovery(raw, lang, hintedIntent) {
  if (!raw || typeof raw !== 'object') {
    return { intent: hintedIntent === 'quote' ? 'quote' : 'topic', books: [] };
  }

  const intent = VALID_INTENTS.has(raw.intent)
    ? raw.intent
    : hintedIntent === 'quote'
      ? 'quote'
      : 'topic';
  const books = (Array.isArray(raw.books) ? raw.books : [])
    .map((book) => normalizeCandidate(book, lang))
    .filter(Boolean)
    .slice(0, intent === 'quote' || intent === 'title' ? 1 : MAX_RESULTS);

  return { intent, books };
}

function discoveryPrompt(query, lang, hintedIntent) {
  return [
    {
      role: 'system',
      content:
        `You are a conservative literary source identifier. Reply ONLY as valid JSON. ` +
        `The response language is ${languageName(lang)}. ` +
        `Never invent a book, author, quote source, year, translation, or title. ` +
        `If evidence is insufficient, return an empty books array. Guessing is a failure. ` +
        `Before searching, silently restore likely apostrophes, punctuation, transliteration, and minor spelling mistakes in the user's quote. ` +
        `Classify intent as quote, author, title, or topic. The heuristic hint is "${hintedIntent}". ` +
        `For quote intent: identify the exact literary work (book, poem, story, play, or doston) and its author. Return exactly ONE source only when you know it with high certainty; otherwise return none. ` +
        `For author intent: return only books actually written by that author; never add similar authors. ` +
        `For title intent: return only the exact real book. ` +
        `For topic intent: return at most 5 well-established real books; never fill a quota. ` +
        `Use this schema: {"intent":"quote|author|title|topic","books":[{"title":"...","author":"...","year":null,"language":"${lang}","genre":"...","reason":"short reason","confidence":0.0}]}. ` +
        `For quote/title, confidence must be at least 0.90 or books must be empty.`
    },
    { role: 'user', content: query }
  ];
}

function verificationPrompt(query, lang, discovery) {
  return [
    {
      role: 'system',
      content:
        `You are an independent fact checker for literary search. Reply ONLY as valid JSON. ` +
        `Do not trust the proposed candidates. Verify from your own knowledge. ` +
        `Reject anything uncertain, invented, misattributed, merely similar, or from the wrong author. ` +
        `For a quote, approve only if the exact quote/source attribution is known; thematic similarity is not evidence. ` +
        `Use schema: {"approved":[{"title":"...","author":"...","confidence":0.0}]}. ` +
        `Only confidence >= 0.90 counts as approval. Response language context: ${languageName(lang)}.`
    },
    {
      role: 'user',
      content: JSON.stringify({
        query,
        intent: discovery.intent,
        candidates: discovery.books.map(({ title, author, year }) => ({ title, author, year }))
      })
    }
  ];
}

async function fetchJson(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const body = await response.text();
    if (!response.ok) {
      return { ok: false, status: response.status, body: body.slice(0, 160) };
    }
    return { ok: true, data: cleanJson(body) || body };
  } catch (error) {
    return { ok: false, status: error.name === 'AbortError' ? 'timeout' : 'error', body: error.message };
  } finally {
    clearTimeout(timer);
  }
}

async function callGroq(messages, model, timeoutMs = 9000) {
  if (!GROQ_API_KEY) return { provider: 'groq', error: 'no_key' };
  const result = await fetchJson(
    GROQ_URL,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        max_tokens: 900,
        response_format: { type: 'json_object' },
        messages
      })
    },
    timeoutMs
  );
  if (!result.ok) return { provider: 'groq', error: String(result.status) };
  const content = result.data?.choices?.[0]?.message?.content;
  return { provider: 'groq', value: cleanJson(content) };
}

async function callGemini(messages, timeoutMs = 9000, useGoogleSearch = false) {
  if (!GEMINI_API_KEY) return { provider: 'gemini', error: 'no_key' };
  const system = messages.find((message) => message.role === 'system')?.content || '';
  const user = messages.filter((message) => message.role !== 'system')
    .map((message) => message.content)
    .join('\n');
  const result = await fetchJson(
    `${GEMINI_BASE_URL}/${encodeURIComponent(GEMINI_MODEL)}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: user }] }],
        ...(useGoogleSearch && GEMINI_ENABLE_SEARCH ? { tools: [{ google_search: {} }] } : {}),
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 900,
          responseMimeType: 'application/json',
          thinkingConfig: { thinkingLevel: 'minimal' }
        }
      })
    },
    timeoutMs
  );
  if (!result.ok) return { provider: 'gemini', error: String(result.status) };
  const content = result.data?.candidates?.[0]?.content?.parts?.[0]?.text;
  return { provider: 'gemini', value: cleanJson(content) };
}

async function callOpenRouter(messages, timeoutMs = 9000) {
  if (!OPENROUTER_API_KEY) return { provider: 'openrouter', error: 'no_key' };
  const result = await fetchJson(
    OPENROUTER_URL,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': process.env.FRONTEND_URL || 'http://localhost:3000',
        'X-Title': 'StatBooks'
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        temperature: 0,
        max_tokens: 900,
        messages
      })
    },
    timeoutMs
  );
  if (!result.ok) return { provider: 'openrouter', error: String(result.status) };
  const content = result.data?.choices?.[0]?.message?.content;
  return { provider: 'openrouter', value: cleanJson(content) };
}

async function callNvidia(messages, timeoutMs = 9000) {
  if (!NVIDIA_API_KEY) return { provider: 'nvidia', error: 'no_key' };
  const result = await fetchJson(
    NVIDIA_URL,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${NVIDIA_API_KEY}`
      },
      body: JSON.stringify({
        model: NVIDIA_MODEL,
        temperature: 0,
        max_tokens: 900,
        messages
      })
    },
    timeoutMs
  );
  if (!result.ok) return { provider: 'nvidia', error: String(result.status) };
  const content = result.data?.choices?.[0]?.message?.content;
  return { provider: 'nvidia', value: cleanJson(content) };
}

async function discover(query, lang, hintedIntent, diag) {
  const messages = discoveryPrompt(query, lang, hintedIntent);
  const groundWithSearch = hintedIntent === 'quote';
  const providers = [
    () => callGemini(messages, 13000, groundWithSearch),
    () => callGroq(messages, GROQ_PRIMARY_MODEL, 7000),
    () => callNvidia(messages, 7000),
    () => callOpenRouter(messages, 7000)
  ];

  for (const provider of providers) {
    const response = await provider();
    if (response.error === 'no_key') continue;
    if (diag) diag.push(`${response.provider}: ${response.value ? 'discovery_ok' : response.error || 'invalid_json'}`);
    if (response.value) {
      const normalized = normalizeDiscovery(response.value, lang, hintedIntent);
      if (normalized.books.length > 0) {
        return { ...normalized, provider: response.provider };
      }
      if (diag) diag.push(`${response.provider}: discovery_empty`);
    }
  }
  return { intent: hintedIntent === 'quote' ? 'quote' : 'topic', books: [], provider: null };
}

async function verify(query, lang, discovery, diag) {
  if (!discovery.books.length) return [];
  const messages = verificationPrompt(query, lang, discovery);
  const groundWithSearch = discovery.intent === 'quote' || discovery.intent === 'title';

  // A provider must never verify its own candidate. Different models from the
  // same provider can repeat the same hallucination, especially for obscure
  // or fabricated quotes.
  const providers = [
    ['gemini', () => callGemini(messages, 13000, groundWithSearch)],
    ['nvidia', () => callNvidia(messages, 7000)],
    ['openrouter', () => callOpenRouter(messages, 7000)],
    ['groq', () => callGroq(messages, GROQ_VERIFY_MODEL, 7000)]
  ].filter(([name]) => name !== discovery.provider);

  for (const [, provider] of providers) {
    const response = await provider();
    if (response.error === 'no_key') continue;
    if (diag) diag.push(`${response.provider}: ${response.value ? 'verification_ok' : response.error || 'invalid_json'}`);
    if (response.value) {
      const approved = Array.isArray(response.value.approved) ? response.value.approved : [];
      const minimumCandidateConfidence =
        discovery.intent === 'quote' || discovery.intent === 'title' ? 0.9 : 0.75;
      const matched = discovery.books.flatMap((candidate) => {
        if (candidate.confidence < minimumCandidateConfidence) return [];
        const match = approved.find((item) =>
          Number(item?.confidence) >= 0.9 &&
          sameBook(candidate, item)
        );
        if (!match) return [];
        return [{
          ...candidate,
          confidence: Math.min(candidate.confidence, Number(match.confidence))
        }];
      });
      if (matched.length) return matched;
      if (diag) diag.push(`${response.provider}: verification_rejected`);
    }
  }
  return [];
}

function formatResults(books, intent, lang) {
  return books.map((book, index) => {
    const id = crypto
      .createHash('sha256')
      .update(`${normalizeKey(book.title)}|${normalizeKey(book.author)}`)
      .digest('hex')
      .slice(0, 16);
    return {
      quoteId: `ai-${id}-${index}`,
      text: book.reason || '',
      pageNumber: null,
      confidence: book.confidence,
      score: 0,
      book: {
        id: null,
        title: book.title,
        titleOriginal: null,
        titleUz: null,
        author: book.author,
        authorUz: null,
        language: book.language || lang,
        year: book.year,
        isbn: null,
        genre: book.genre || null,
        pages: null,
        themes: [],
        rating: null,
        coverImage: null,
        affiliateLink: null,
        likes: 0
      },
      source: 'ai_verified',
      intent
    };
  });
}

async function strictAiSearch(query, lang = 'uz', diag = null) {
  const safeLang = VALID_LANGS.has(lang) ? lang : 'uz';
  const cleanQuery = String(query || '').trim().slice(0, 1000);
  if (!cleanQuery) return { intent: 'topic', status: 'not_found', results: [] };

  const hintedIntent = hintIntent(cleanQuery);
  const discovery = await discover(cleanQuery, safeLang, hintedIntent, diag);
  const approved = await verify(cleanQuery, safeLang, discovery, diag);

  // Exact-source searches must never degrade into "related books".
  const strictBooks =
    discovery.intent === 'quote' || discovery.intent === 'title'
      ? approved.slice(0, 1)
      : approved.slice(0, MAX_RESULTS);

  return {
    intent: discovery.intent,
    status: strictBooks.length ? 'found' : 'not_found',
    results: formatResults(strictBooks, discovery.intent, safeLang)
  };
}

module.exports = {
  strictAiSearch,
  hintIntent,
  normalizeDiscovery,
  sameBook
};
