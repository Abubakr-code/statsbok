require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const fetch = require('node-fetch');
const cron = require('node-cron');

// ── Config ────────────────────────────────────────────────────────────────────
const TOKEN          = process.env.TELEGRAM_BOT_TOKEN;
const BACKEND        = (process.env.BACKEND_URL  || 'http://localhost:5000').replace(/\/$/, '');
const FRONTEND       = (process.env.FRONTEND_URL || 'https://statbooks.uz').replace(/\/$/, '');
const MODE           = process.env.BOT_MODE || 'polling';
const CHANNEL        = process.env.CHANNEL_USERNAME || '@statsbooks';
const REQUIRE_CHANNEL = process.env.REQUIRE_CHANNEL === 'true';

const OPENROUTER_URL          = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_CHAT_API_KEY = process.env.OPENROUTER_CHAT_API_KEY;
const OPENROUTER_CHAT_MODEL   = process.env.OPENROUTER_CHAT_MODEL || 'nvidia/nemotron-3-super-120b-a12b:free';

const AI_FREE_MODELS = [
  OPENROUTER_CHAT_MODEL,
  'nvidia/nemotron-3-super-120b-a12b:free',
  'openai/gpt-oss-120b:free',
  'google/gemma-4-31b-it:free',
  'openai/gpt-oss-20b:free',
  'meta-llama/llama-3.3-70b-instruct:free',
  'openrouter/free',
].filter((v, i, a) => a.indexOf(v) === i);

const AI_SYSTEM_PROMPT =
  'Sen — "StatBooks AI", kitoblar va adabiyot bo\'yicha ixtisoslashgan yordamchi. ' +
  'StatBooks platformasi kitob iqtiboslarini topish va kitoblarni kashf etish uchun. ' +
  'Javoblaringni qisqa (2-5 jumla), issiq va do\'stona uslubda yoz. ' +
  'Kitob nomlari va muallif ismlarini <b>qalin</b> yoz (HTML formatda). ' +
  'Foydalanuvchi qaysi tilda yozsa — o\'sha tilda javob ber (o\'zbek, rus yoki ingliz). ' +
  'Kitoblar bilan bog\'liq bo\'lmagan savollar kelsa, muloyimlik bilan mavzuni kitoblarga qaytargin.';

const PAGE_SIZE = 3;
const AI_MAX_HISTORY = 14;

if (!TOKEN) {
  console.error('TELEGRAM_BOT_TOKEN .env faylida ko\'rsatilmagan');
  process.exit(1);
}

// ── Bot instance ──────────────────────────────────────────────────────────────
let bot;
if (MODE === 'webhook') {
  bot = new TelegramBot(TOKEN);
  // On Render the platform supplies PORT and RENDER_EXTERNAL_URL automatically,
  // so the bot works with no manual WEBHOOK_URL/WEBHOOK_PORT configuration.
  const port = Number(process.env.PORT || process.env.WEBHOOK_PORT) || 3001;
  const webhookUrl = process.env.WEBHOOK_URL || process.env.RENDER_EXTERNAL_URL;
  if (!webhookUrl) { console.error('WEBHOOK_URL yoki RENDER_EXTERNAL_URL kerak'); process.exit(1); }
  bot.setWebHook(`${webhookUrl.replace(/\/$/, '')}/bot${TOKEN}`);
  const http = require('http');
  http.createServer((req, res) => {
    if (req.method === 'POST' && req.url === `/bot${TOKEN}`) {
      let body = '';
      req.on('data', d => body += d);
      req.on('end', () => {
        try { bot.processUpdate(JSON.parse(body)); } catch {}
        res.writeHead(200).end('ok');
      });
    } else {
      // Any other path (incl. the platform health probe) gets a simple 200.
      res.writeHead(200).end('StatBooks bot ishlamoqda');
    }
  }).listen(port, () => console.log(`Webhook port ${port} da ishlamoqda`));
} else {
  bot = new TelegramBot(TOKEN, { polling: true });
  console.log('StatBooks bot polling rejimida ishlamoqda...');
}

// ── i18n ──────────────────────────────────────────────────────────────────────
const MSGS = {
  uz: {
    langSelect:     '🌐 <b>Tilni tanlang:</b>',
    langSet:        '✅ Til o\'zgartirildi: O\'zbek 🇺🇿',
    welcome:        (n) => `📖 <b>Assalomu alaykum, ${n}!</b>\n\nStatBooks — kitob iqtiboslarini topish platformasi.\n\nIqtibos matni, muallif ismi yoki mavzu yozing — darhol topib beraman!\n\n📌 /help — barcha komandalar`,
    howto:          'Qidiruv uchun iqtibos yoki muallif yozing.',
    searching:      '🔍 Qidirilmoqda...',
    noResults:      (q) => `😔 <b>"${q}"</b> bo\'yicha hech narsa topilmadi.\n\n💡 Boshqacha so\'z bilan urinib ko\'ring.`,
    rateLimit:      '⏳ Juda ko\'p so\'rov. Bir daqiqa kuting.',
    tooShort:       '✏️ Kamida 2 ta harf kiriting.',
    tooLong:        '✏️ So\'rov 500 ta belgidan qisqa bo\'lsin.',
    page:           (c, t) => `📄 ${c}/${t}-sahifa`,
    btnPreview:     '📄 Ko\'rish',
    btnShare:       '📤 Do\'stga',
    btnSite:        '🌐 Saytda',
    btnPrev:        '⬅ Oldingi',
    btnNext:        'Keyingi ➡',
    btnNewSearch:   '🔍 Yangi qidiruv',
    subscribed:     '✅ Obuna qilindi! Har kuni ertalab 9:00 da bitta iqtibos olasiz.',
    unsubscribed:   '❌ Obuna bekor qilindi.',
    alreadySub:     '✅ Siz allaqachon obunasiz!',
    notSub:         'ℹ️ Siz obuna emassiz.',
    aiWelcome:      '🤖 <b>AI rejimi yoqildi</b>\n\nKitoblar, iqtiboslar, mualliflar haqida so\'rang!\n\n<i>Chiqish: /start</i>',
    aiExit:         '✅ AI rejimdan chiqildi.',
    aiError:        '😔 AI javob bera olmadi. Qayta urinib ko\'ring.',
    aiBtnExit:      '❌ AI rejimdan chiqish',
    channelReq:     `📢 Botdan foydalanish uchun avval kanalga a'zo bo'ling:`,
    channelBtn:     '📢 Kanalga kirish',
    channelCheck:   '✅ A\'zo bo\'ldim',
    loginMsg:       `🔐 <b>Saytga kirish</b>\n\nStatBooks.uz ga kiring va iqtiboslarni saqlang, AI bilan suhbatlashing!`,
    loginBtn:       '🔐 Saytga kirish',
    premiumMsg:     `⭐ <b>StatBooks Premium</b>\n\n• Cheksiz iqtibos saqlash\n• AI tahlil va tavsiyalar\n• Reklamasiz tajriba\n• Barcha janrlar ochiq\n\nPremium narxi: juda qulay!`,
    premiumBtn:     '⭐ Premium olish',
    topLoading:     '🔥 Top iqtiboslar yuklanmoqda...',
    topEmpty:       '📭 Hozircha ma\'lumot yo\'q.',
    topTitle:       '🔥 <b>Haftalik TOP iqtiboslar:</b>',
    more:           (n, url) => `🔎 Jami <b>${n}</b> ta natija. <a href="${url}">Barchasini saytda ko\'rish</a>`,
    allShown:       '✅ Barcha natijalar ko\'rsatildi.',
    saves:          (n) => `❤️ ${n} marta saqlangan`,
    helpText:       `📚 <b>StatBooks Bot — Yordam</b>\n\n<b>Komandalar:</b>\n/start — Bosh sahifa\n/help — Ushbu yordam\n/top — Haftalik top iqtiboslar\n/lang — Tilni o\'zgartirish\n/login — Saytga kirish\n/premium — Premium haqida\n/subscribe — Kunlik iqtibos obunasi\n/unsubscribe — Obunani bekor qilish\n/ai — AI suhbat rejimi\n\nYoki shunchaki iqtibos yozing! 📖`,
    savedMsg:       `🔖 <b>Saqlangan iqtiboslar</b>\n\nSaqlangan iqtiboslaringizni saytda ko\'ring:`,
    savedBtn:       '🔖 Saqlangan iqtiboslar',
    dailyTitle:     '📖 <b>Bugungi iqtibos</b>',
  },
  ru: {
    langSelect:     '🌐 <b>Выберите язык:</b>',
    langSet:        '✅ Язык изменён: Русский 🇷🇺',
    welcome:        (n) => `📖 <b>Добро пожаловать, ${n}!</b>\n\nStatBooks — платформа для поиска книжных цитат.\n\nНапишите цитату, имя автора или тему — найду мгновенно!\n\n📌 /help — все команды`,
    howto:          'Введите цитату или автора для поиска.',
    searching:      '🔍 Поиск...',
    noResults:      (q) => `😔 По запросу <b>"${q}"</b> ничего не найдено.\n\n💡 Попробуйте другие слова.`,
    rateLimit:      '⏳ Слишком много запросов. Подождите минуту.',
    tooShort:       '✏️ Введите минимум 2 символа.',
    tooLong:        '✏️ Запрос не более 500 символов.',
    page:           (c, t) => `📄 ${c}/${t}`,
    btnPreview:     '📄 Открыть',
    btnShare:       '📤 Поделиться',
    btnSite:        '🌐 На сайте',
    btnPrev:        '⬅ Назад',
    btnNext:        'Вперёд ➡',
    btnNewSearch:   '🔍 Новый поиск',
    subscribed:     '✅ Подписка оформлена! Каждый день в 9:00 будете получать цитату.',
    unsubscribed:   '❌ Подписка отменена.',
    alreadySub:     '✅ Вы уже подписаны!',
    notSub:         'ℹ️ Вы не подписаны.',
    aiWelcome:      '🤖 <b>Режим AI включён</b>\n\nСпросите о книгах, цитатах, авторах!\n\n<i>Выход: /start</i>',
    aiExit:         '✅ Вышли из режима AI.',
    aiError:        '😔 AI не смог ответить. Попробуйте ещё раз.',
    aiBtnExit:      '❌ Выйти из режима AI',
    channelReq:     'Для использования бота подпишитесь на канал:',
    channelBtn:     '📢 Перейти в канал',
    channelCheck:   '✅ Я подписался',
    loginMsg:       '🔐 <b>Войдите на сайт</b>\n\nЗайдите на StatBooks.uz чтобы сохранять цитаты и пользоваться AI!',
    loginBtn:       '🔐 Войти на сайт',
    premiumMsg:     '⭐ <b>StatBooks Premium</b>\n\n• Безлимитное сохранение\n• AI анализ и рекомендации\n• Без рекламы\n• Все жанры открыты',
    premiumBtn:     '⭐ Получить Premium',
    topLoading:     '🔥 Загрузка топ цитат...',
    topEmpty:       '📭 Пока нет данных.',
    topTitle:       '🔥 <b>Топ цитаты недели:</b>',
    more:           (n, url) => `🔎 Всего <b>${n}</b> результатов. <a href="${url}">Смотреть все на сайте</a>`,
    allShown:       '✅ Все результаты показаны.',
    saves:          (n) => `❤️ ${n} сохранений`,
    helpText:       `📚 <b>StatBooks Bot — Помощь</b>\n\n<b>Команды:</b>\n/start — Главная\n/help — Помощь\n/top — Топ цитаты\n/lang — Сменить язык\n/login — Войти на сайт\n/premium — О Premium\n/subscribe — Ежедневная цитата\n/unsubscribe — Отменить подписку\n/ai — Режим AI\n\nИли просто напишите цитату! 📖`,
    savedMsg:       '🔖 <b>Сохранённые цитаты</b>\n\nПросматривайте сохранённые цитаты на сайте:',
    savedBtn:       '🔖 Сохранённые цитаты',
    dailyTitle:     '📖 <b>Цитата дня</b>',
  },
  en: {
    langSelect:     '🌐 <b>Select language:</b>',
    langSet:        '✅ Language set: English 🇬🇧',
    welcome:        (n) => `📖 <b>Welcome, ${n}!</b>\n\nStatBooks — find any book by its quote.\n\nType a quote, author name, or topic and I'll find it instantly!\n\n📌 /help — all commands`,
    howto:          'Type a quote or author to search.',
    searching:      '🔍 Searching...',
    noResults:      (q) => `😔 Nothing found for <b>"${q}"</b>.\n\n💡 Try different words.`,
    rateLimit:      '⏳ Too many requests. Wait a minute.',
    tooShort:       '✏️ Enter at least 2 characters.',
    tooLong:        '✏️ Query must be under 500 characters.',
    page:           (c, t) => `📄 ${c}/${t}`,
    btnPreview:     '📄 View',
    btnShare:       '📤 Share',
    btnSite:        '🌐 Website',
    btnPrev:        '⬅ Previous',
    btnNext:        'Next ➡',
    btnNewSearch:   '🔍 New search',
    subscribed:     '✅ Subscribed! You will receive a daily quote every morning at 9:00.',
    unsubscribed:   '❌ Unsubscribed.',
    alreadySub:     '✅ You are already subscribed!',
    notSub:         'ℹ️ You are not subscribed.',
    aiWelcome:      '🤖 <b>AI mode enabled</b>\n\nAsk about books, quotes, authors!\n\n<i>Exit: /start</i>',
    aiExit:         '✅ Exited AI mode.',
    aiError:        '😔 AI failed to respond. Try again.',
    aiBtnExit:      '❌ Exit AI mode',
    channelReq:     'Please join our channel to use the bot:',
    channelBtn:     '📢 Join Channel',
    channelCheck:   '✅ I\'ve joined',
    loginMsg:       '🔐 <b>Login to StatBooks</b>\n\nVisit StatBooks.uz to save quotes and chat with AI!',
    loginBtn:       '🔐 Login',
    premiumMsg:     '⭐ <b>StatBooks Premium</b>\n\n• Unlimited saves\n• AI analysis & recommendations\n• No ads\n• All genres unlocked',
    premiumBtn:     '⭐ Get Premium',
    topLoading:     '🔥 Loading top quotes...',
    topEmpty:       '📭 No data yet.',
    topTitle:       '🔥 <b>Weekly Top Quotes:</b>',
    more:           (n, url) => `🔎 <b>${n}</b> results total. <a href="${url}">View all on site</a>`,
    allShown:       '✅ All results shown.',
    saves:          (n) => `❤️ ${n} saves`,
    helpText:       `📚 <b>StatBooks Bot — Help</b>\n\n<b>Commands:</b>\n/start — Home\n/help — Help\n/top — Top quotes\n/lang — Change language\n/login — Login to site\n/premium — About Premium\n/subscribe — Daily quote\n/unsubscribe — Cancel subscription\n/ai — AI chat mode\n\nOr just type a quote! 📖`,
    savedMsg:       '🔖 <b>Saved Quotes</b>\n\nView your saved quotes on the site:',
    savedBtn:       '🔖 Saved Quotes',
    dailyTitle:     '📖 <b>Daily Quote</b>',
  }
};

function t(lang, key, ...args) {
  const m = MSGS[lang] || MSGS.uz;
  const val = (key in m) ? m[key] : (MSGS.uz[key] || key);
  return typeof val === 'function' ? val(...args) : val;
}

// ── State management ──────────────────────────────────────────────────────────
const userState = new Map();

// Clean up idle sessions every hour (3-hour TTL)
setInterval(() => {
  const now = Date.now();
  for (const [id, s] of userState) {
    if (now - (s.lastActivity || 0) > 3 * 60 * 60 * 1000) userState.delete(id);
  }
}, 60 * 60 * 1000).unref();

function getState(chatId) {
  if (!userState.has(chatId)) {
    userState.set(chatId, {
      lang: 'uz',
      lastQuery: '',
      lastResults: [],
      page: 0,
      aiMode: false,
      aiHistory: [],
      lastActivity: Date.now()
    });
  }
  const s = userState.get(chatId);
  s.lastActivity = Date.now();
  return s;
}

// ── Rate limiter ──────────────────────────────────────────────────────────────
const rateLimiter = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [id, r] of rateLimiter) {
    if (now > r.resetAt) rateLimiter.delete(id);
  }
}, 60 * 1000).unref();

function checkRateLimit(chatId) {
  const now = Date.now();
  const r = rateLimiter.get(chatId);
  if (!r || now > r.resetAt) {
    rateLimiter.set(chatId, { count: 1, resetAt: now + 60000 });
    return true;
  }
  if (r.count >= 10) return false;
  r.count++;
  return true;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function truncate(str, max) {
  const s = String(str || '');
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

function detectLang(text) {
  const hasCyrillic = /[Ѐ-ӿ]/.test(text);
  const hasRuLetters = /[ёЁъЪыЫэЭ]/.test(text);
  const hasLatin = /[a-zA-Z]/.test(text);
  if (hasRuLetters) return 'ru';
  if (hasCyrillic) return 'uz';
  if (hasLatin) return 'en';
  return 'uz';
}

function isHttpUrl(str) {
  return /^https?:\/\//.test(String(str || ''));
}

// ── API calls ─────────────────────────────────────────────────────────────────
async function apiGet(path, timeoutMs = 15000) {
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${BACKEND}/api${path}`, {
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal
    });
    if (!res.ok) throw new Error(`API ${res.status}`);
    return res.json();
  } finally {
    clearTimeout(tid);
  }
}

async function apiPost(path, body) {
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(`${BACKEND}/api${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    if (!res.ok) throw new Error(`API ${res.status}`);
    return res.json();
  } finally {
    clearTimeout(tid);
  }
}

async function apiSearch(query, lang, timeoutMs = 20000) {
  const url = `/quotes/search?q=${encodeURIComponent(query)}&lang=${lang}`;
  return apiGet(url, timeoutMs);
}

// ── Channel membership check ──────────────────────────────────────────────────
async function isMember(userId) {
  if (!REQUIRE_CHANNEL) return true;
  try {
    const m = await bot.getChatMember(CHANNEL, userId);
    return ['member', 'administrator', 'creator', 'restricted'].includes(m.status);
  } catch {
    return true; // Can't check → allow
  }
}

// ── Result formatting ─────────────────────────────────────────────────────────
function formatResult(item, idx, lang) {
  const book = item.book || {};
  const title = esc(book.titleUz || book.title || 'Noma\'lum kitob');
  const author = esc(book.author || '');
  const year = book.year ? ` (${book.year})` : '';
  const quoteText = esc(truncate(item.text || '', 300));
  const desc = book.description ? esc(truncate(book.description, 180)) : '';

  let msg = `<b>${idx}. 📚 ${title}</b>\n`;
  if (author) msg += `✍️ ${author}${year}\n`;
  msg += `\n❝ <i>${quoteText}</i> ❞`;
  if (desc) msg += `\n\n📖 ${desc}`;
  return msg;
}

function resultKeyboard(item, lang) {
  const quoteText = (item.text || '').slice(0, 80);
  const searchQ = encodeURIComponent(quoteText);
  const siteUrl = `${FRONTEND}/search?q=${searchQ}`;
  const shareText = (item.text || '').slice(0, 60);
  return {
    inline_keyboard: [[
      { text: t(lang, 'btnPreview'), url: siteUrl },
      { text: t(lang, 'btnShare'), switch_inline_query: shareText }
    ]]
  };
}

function paginationKeyboard(state) {
  const { lang, page, lastResults } = state;
  const totalPages = Math.ceil(lastResults.length / PAGE_SIZE);
  const nav = [];
  if (page > 0) nav.push({ text: t(lang, 'btnPrev'), callback_data: `page:${page - 1}` });
  nav.push({ text: t(lang, 'page', page + 1, totalPages), callback_data: 'noop' });
  if (page < totalPages - 1) nav.push({ text: t(lang, 'btnNext'), callback_data: `page:${page + 1}` });
  const rows = [];
  if (nav.length) rows.push(nav);
  rows.push([{ text: t(lang, 'btnNewSearch'), callback_data: 'new_search' }]);
  return { inline_keyboard: rows };
}

// ── Send paginated results ────────────────────────────────────────────────────
async function sendResultsPage(chatId, state, deleteLoadingId) {
  const { lang, lastResults, page, lastQuery } = state;
  const start = page * PAGE_SIZE;
  const slice = lastResults.slice(start, start + PAGE_SIZE);
  const totalPages = Math.ceil(lastResults.length / PAGE_SIZE);
  const count = lastResults.length;

  if (deleteLoadingId) {
    await bot.deleteMessage(chatId, deleteLoadingId).catch(() => {});
  }

  for (let i = 0; i < slice.length; i++) {
    const item = slice[i];
    const idx = start + i + 1;
    const caption = formatResult(item, idx, lang);
    const keyboard = resultKeyboard(item, lang);
    const coverUrl = item.book && item.book.coverImage;

    if (coverUrl && isHttpUrl(coverUrl)) {
      await bot.sendPhoto(chatId, coverUrl, {
        caption,
        parse_mode: 'HTML',
        reply_markup: keyboard
      }).catch(() =>
        bot.sendMessage(chatId, caption, { parse_mode: 'HTML', reply_markup: keyboard })
      );
    } else {
      await bot.sendMessage(chatId, caption, { parse_mode: 'HTML', reply_markup: keyboard });
    }

    if (i < slice.length - 1) await delay(300);
  }

  if (totalPages > 1) {
    await bot.sendMessage(chatId, t(lang, 'page', page + 1, totalPages), {
      reply_markup: paginationKeyboard(state)
    });
  } else {
    const searchUrl = `${FRONTEND}/search?q=${encodeURIComponent(lastQuery)}`;
    const moreMsg = count > PAGE_SIZE
      ? t(lang, 'more', count, searchUrl)
      : t(lang, 'allShown');
    await bot.sendMessage(chatId, moreMsg, {
      parse_mode: 'HTML',
      disable_web_page_preview: true
    });
  }
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── AI chat ───────────────────────────────────────────────────────────────────
async function callAI(chatId) {
  if (!OPENROUTER_CHAT_API_KEY) throw new Error('OPENROUTER_CHAT_API_KEY yo\'q');
  const state = getState(chatId);
  const messages = [
    { role: 'system', content: AI_SYSTEM_PROMPT },
    ...state.aiHistory.slice(-AI_MAX_HISTORY)
  ];

  let lastErr = 'Hech qanday model ishlamadi';
  for (const model of AI_FREE_MODELS) {
    try {
      const controller = new AbortController();
      const tid = setTimeout(() => controller.abort(), 20000);
      const res = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${OPENROUTER_CHAT_API_KEY}`,
          'HTTP-Referer': FRONTEND,
          'X-Title': 'StatBooks'
        },
        body: JSON.stringify({ model, max_tokens: 700, messages }),
        signal: controller.signal
      });
      clearTimeout(tid);
      if (res.ok) {
        const data = await res.json();
        const reply = data.choices?.[0]?.message?.content || '';
        if (reply) { state.aiHistory.push({ role: 'assistant', content: reply }); return reply; }
        lastErr = 'Bo\'sh javob';
      } else {
        lastErr = `${res.status}`;
      }
    } catch (err) {
      lastErr = err.message;
    }
  }
  throw new Error(lastErr);
}

// ── Language selection keyboard ───────────────────────────────────────────────
const LANG_KEYBOARD = {
  inline_keyboard: [[
    { text: '🇺🇿 O\'zbek', callback_data: 'lang:uz' },
    { text: '🇷🇺 Русский', callback_data: 'lang:ru' },
    { text: '🇬🇧 English', callback_data: 'lang:en' }
  ]]
};

// ── Channel check keyboard ────────────────────────────────────────────────────
function channelKeyboard(lang) {
  return {
    inline_keyboard: [[
      { text: t(lang, 'channelBtn'), url: `https://t.me/${CHANNEL.replace('@', '')}` },
      { text: t(lang, 'channelCheck'), callback_data: 'channel_check' }
    ]]
  };
}

// ── Upsert Telegram user in DB ────────────────────────────────────────────────
function syncUser(msg, extra) {
  const from = msg.from || {};
  apiPost('/telegram/user', {
    telegramId: from.id,
    username: from.username || null,
    firstName: from.first_name || null,
    ...extra
  }).catch(() => {});
}

// ─────────────────────────────────────────────────────────────────────────────
// COMMAND HANDLERS
// ─────────────────────────────────────────────────────────────────────────────

// ── /start ────────────────────────────────────────────────────────────────────
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const state = getState(chatId);
  state.aiMode = false;
  state.aiHistory = [];
  syncUser(msg);

  if (REQUIRE_CHANNEL && !(await isMember(msg.from.id))) {
    return bot.sendMessage(chatId, t(state.lang, 'channelReq'), {
      parse_mode: 'HTML',
      reply_markup: channelKeyboard(state.lang)
    });
  }

  const name = esc(msg.from && msg.from.first_name ? msg.from.first_name : 'Do\'st');
  try {
    await bot.sendMessage(chatId, t(state.lang, 'welcome', name), {
      parse_mode: 'HTML',
      reply_markup: LANG_KEYBOARD
    });
  } catch (err) {
    console.error('/start error:', err.message);
  }
});

// ── /help ─────────────────────────────────────────────────────────────────────
bot.onText(/\/help/, async (msg) => {
  const chatId = msg.chat.id;
  const { lang } = getState(chatId);
  try {
    await bot.sendMessage(chatId, t(lang, 'helpText'), {
      parse_mode: 'HTML',
      disable_web_page_preview: true
    });
  } catch (err) {
    console.error('/help error:', err.message);
  }
});

// ── /lang ─────────────────────────────────────────────────────────────────────
bot.onText(/\/lang/, async (msg) => {
  const { lang } = getState(msg.chat.id);
  try {
    await bot.sendMessage(msg.chat.id, t(lang, 'langSelect'), {
      parse_mode: 'HTML',
      reply_markup: LANG_KEYBOARD
    });
  } catch (err) {
    console.error('/lang error:', err.message);
  }
});

// ── /top ──────────────────────────────────────────────────────────────────────
bot.onText(/\/top/, async (msg) => {
  const chatId = msg.chat.id;
  const state = getState(chatId);
  state.aiMode = false;
  const { lang } = state;
  const loadMsg = await bot.sendMessage(chatId, t(lang, 'topLoading'));
  try {
    const data = await apiGet('/users/weekly-stats');
    const stats = data.stats || [];
    if (!stats.length) {
      await bot.editMessageText(t(lang, 'topEmpty'), {
        chat_id: chatId, message_id: loadMsg.message_id
      });
      return;
    }
    await bot.editMessageText(t(lang, 'topTitle'), {
      chat_id: chatId, message_id: loadMsg.message_id, parse_mode: 'HTML'
    });
    for (let i = 0; i < Math.min(5, stats.length); i++) {
      const item = stats[i];
      const book = item.book || {};
      const title = esc(book.title || 'Noma\'lum kitob');
      const author = esc(book.author || '');
      const quote = esc(truncate(item.text || '', 220));
      const saves = item.saves || 0;
      let text = `<b>${i + 1}. 📚 ${title}</b>\n`;
      if (author) text += `✍️ ${author}\n`;
      text += `\n❝ <i>${quote}</i> ❞\n`;
      text += `\n${t(lang, 'saves', saves)}`;
      await bot.sendMessage(chatId, text, { parse_mode: 'HTML' });
      if (i < 4) await delay(300);
    }
  } catch (err) {
    console.error('/top error:', err.message);
    await bot.editMessageText('Yuklab bo\'lmadi. Keyinroq urinib ko\'ring.', {
      chat_id: chatId, message_id: loadMsg.message_id
    }).catch(() => {});
  }
});

// ── /subscribe ────────────────────────────────────────────────────────────────
bot.onText(/\/subscribe/, async (msg) => {
  const chatId = msg.chat.id;
  const state = getState(chatId);
  const { lang } = state;
  try {
    const data = await apiPost('/telegram/user', {
      telegramId: msg.from.id,
      username: msg.from.username || null,
      firstName: msg.from.first_name || null,
      lang,
      subscribed: true
    });
    if (data.subscribed === false) {
      await bot.sendMessage(chatId, t(lang, 'alreadySub'));
    } else {
      await bot.sendMessage(chatId, t(lang, 'subscribed'));
    }
  } catch (err) {
    await bot.sendMessage(chatId, t(lang, 'subscribed'));
  }
});

// ── /unsubscribe ──────────────────────────────────────────────────────────────
bot.onText(/\/unsubscribe/, async (msg) => {
  const chatId = msg.chat.id;
  const { lang } = getState(chatId);
  try {
    await apiPost('/telegram/user', {
      telegramId: msg.from.id,
      subscribed: false
    });
  } catch {}
  await bot.sendMessage(chatId, t(lang, 'unsubscribed'));
});

// ── /saved ────────────────────────────────────────────────────────────────────
bot.onText(/\/saved/, async (msg) => {
  const chatId = msg.chat.id;
  const { lang } = getState(chatId);
  try {
    await bot.sendMessage(chatId, t(lang, 'savedMsg'), {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[{
          text: t(lang, 'savedBtn'),
          url: `${FRONTEND}/archive`
        }]]
      }
    });
  } catch (err) {
    console.error('/saved error:', err.message);
  }
});

// ── /login ────────────────────────────────────────────────────────────────────
bot.onText(/\/login/, async (msg) => {
  const chatId = msg.chat.id;
  const { lang } = getState(chatId);
  try {
    await bot.sendMessage(chatId, t(lang, 'loginMsg'), {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: [[{ text: t(lang, 'loginBtn'), url: FRONTEND }]] }
    });
  } catch (err) {
    console.error('/login error:', err.message);
  }
});

// ── /premium ──────────────────────────────────────────────────────────────────
bot.onText(/\/premium/, async (msg) => {
  const chatId = msg.chat.id;
  const { lang } = getState(chatId);
  try {
    await bot.sendMessage(chatId, t(lang, 'premiumMsg'), {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[{
          text: t(lang, 'premiumBtn'),
          url: `${FRONTEND}/premium`
        }]]
      }
    });
  } catch (err) {
    console.error('/premium error:', err.message);
  }
});

// ── /ai ───────────────────────────────────────────────────────────────────────
bot.onText(/\/ai/, async (msg) => {
  const chatId = msg.chat.id;
  const state = getState(chatId);
  if (!OPENROUTER_CHAT_API_KEY) {
    await bot.sendMessage(chatId, '❌ AI rejimi sozlanmagan.');
    return;
  }
  state.aiMode = true;
  state.aiHistory = [];
  const { lang } = state;
  try {
    await bot.sendMessage(chatId, t(lang, 'aiWelcome'), {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: [[{ text: t(lang, 'aiBtnExit'), callback_data: 'exit_ai' }]] }
    });
  } catch (err) {
    console.error('/ai error:', err.message);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// INLINE QUERY (@ mode)
// ─────────────────────────────────────────────────────────────────────────────
bot.on('inline_query', async (query) => {
  const q = (query.query || '').trim();
  if (!q || q.length < 2) {
    await bot.answerInlineQuery(query.id, [], { cache_time: 30 }).catch(() => {});
    return;
  }
  try {
    const lang = detectLang(q);
    const data = await apiGet(`/telegram/inline?q=${encodeURIComponent(q)}&lang=${lang}`, 8000);
    const results = (data.results || []).slice(0, 8);
    const answers = results.map((item, idx) => {
      const book = item.book || {};
      const title = (book.titleUz || book.title || 'Noma\'lum kitob').slice(0, 100);
      const author = book.author || '';
      const year   = book.year ? ` (${book.year})` : '';
      const quoteText = (item.text || '').slice(0, 300);
      const desc  = author + year;
      const searchQ  = encodeURIComponent((item.text || '').slice(0, 80));
      const siteUrl  = `${FRONTEND}/search?q=${searchQ}`;
      const msgText  =
        `📚 <b>${esc(title)}</b>\n` +
        (author ? `✍️ ${esc(author)}${esc(year)}\n` : '') +
        `\n❝ <i>${esc(truncate(quoteText, 280))}</i> ❞\n\n` +
        `🔗 <a href="${siteUrl}">StatBooks da ko'rish</a>`;

      return {
        type: 'article',
        id: String(idx),
        title,
        description: desc || quoteText.slice(0, 60),
        input_message_content: {
          message_text: msgText,
          parse_mode: 'HTML'
        },
        reply_markup: {
          inline_keyboard: [[
            { text: '🌐 Saytda ko\'rish', url: siteUrl },
            { text: '📤 Do\'stga', switch_inline_query: quoteText.slice(0, 60) }
          ]]
        }
      };
    });
    await bot.answerInlineQuery(query.id, answers, { cache_time: 60 }).catch(() => {});
  } catch (err) {
    console.error('Inline query error:', err.message);
    await bot.answerInlineQuery(query.id, [], { cache_time: 10 }).catch(() => {});
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// CALLBACK QUERY (buttons)
// ─────────────────────────────────────────────────────────────────────────────
bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const state  = getState(chatId);
  const data   = query.data || '';
  const { lang } = state;

  await bot.answerCallbackQuery(query.id).catch(() => {});

  // Language selection
  if (data.startsWith('lang:')) {
    const newLang = data.split(':')[1];
    if (['uz', 'ru', 'en'].includes(newLang)) {
      state.lang = newLang;
      syncUser(query.message, { telegramId: query.from.id, lang: newLang });
      await bot.sendMessage(chatId, t(newLang, 'langSet')).catch(() => {});
    }
    return;
  }

  // Pagination
  if (data.startsWith('page:')) {
    const newPage = Number(data.split(':')[1]);
    const maxPage = Math.ceil(state.lastResults.length / PAGE_SIZE) - 1;
    if (!isNaN(newPage) && newPage >= 0 && newPage <= maxPage) {
      state.page = newPage;
      await sendResultsPage(chatId, state, null);
    }
    return;
  }

  // Exit AI mode
  if (data === 'exit_ai') {
    state.aiMode = false;
    state.aiHistory = [];
    await bot.editMessageReplyMarkup({ inline_keyboard: [] }, {
      chat_id: chatId,
      message_id: query.message.message_id
    }).catch(() => {});
    await bot.sendMessage(chatId, t(lang, 'aiExit')).catch(() => {});
    return;
  }

  // Channel membership check
  if (data === 'channel_check') {
    const ok = await isMember(query.from.id);
    if (ok) {
      const name = esc(query.from.first_name || 'Do\'st');
      await bot.sendMessage(chatId, t(lang, 'welcome', name), {
        parse_mode: 'HTML',
        reply_markup: LANG_KEYBOARD
      }).catch(() => {});
    } else {
      await bot.sendMessage(chatId, t(lang, 'channelReq'), {
        parse_mode: 'HTML',
        reply_markup: channelKeyboard(lang)
      }).catch(() => {});
    }
    return;
  }

  // New search shortcut
  if (data === 'new_search') {
    await bot.sendMessage(chatId, t(lang, 'howto')).catch(() => {});
    return;
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// MAIN MESSAGE HANDLER
// ─────────────────────────────────────────────────────────────────────────────
bot.on('message', async (msg) => {
  if (!msg.text || msg.text.startsWith('/')) return;

  const chatId = msg.chat.id;
  const state  = getState(chatId);
  const query  = msg.text.trim();
  const { lang } = state;

  if (query.length < 2) {
    await bot.sendMessage(chatId, t(lang, 'tooShort'));
    return;
  }
  if (query.length > 500) {
    await bot.sendMessage(chatId, t(lang, 'tooLong'));
    return;
  }
  if (!checkRateLimit(chatId)) {
    await bot.sendMessage(chatId, t(lang, 'rateLimit'));
    return;
  }

  // ── AI mode ────────────────────────────────────────────────────────────────
  if (state.aiMode) {
    await bot.sendChatAction(chatId, 'typing').catch(() => {});
    const loadMsg = await bot.sendMessage(chatId, '🤔...');
    state.aiHistory.push({ role: 'user', content: query.slice(0, 1500) });
    try {
      const reply = await callAI(chatId);
      await bot.deleteMessage(chatId, loadMsg.message_id).catch(() => {});
      await bot.sendMessage(chatId, reply, {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: [[{ text: t(lang, 'aiBtnExit'), callback_data: 'exit_ai' }]] }
      });
    } catch (err) {
      console.error('AI error:', err.message);
      await bot.editMessageText(t(lang, 'aiError'), {
        chat_id: chatId, message_id: loadMsg.message_id
      }).catch(() => {});
    }
    return;
  }

  // ── Search mode ────────────────────────────────────────────────────────────
  await runSearch(chatId, state, query);
});

// ── Shared search runner ──────────────────────────────────────────────────────
async function runSearch(chatId, state, query) {
  const { lang } = state;
  const loadMsg = await bot.sendMessage(chatId, t(lang, 'searching'));
  try {
    const effectiveLang = detectLang(query) || lang;
    const data = await apiSearch(query, effectiveLang, 22000);
    const results = data.results || [];

    if (!results.length) {
      await bot.editMessageText(t(lang, 'noResults', esc(truncate(query, 60))), {
        chat_id: chatId, message_id: loadMsg.message_id, parse_mode: 'HTML'
      });
      return;
    }

    state.lastQuery   = query;
    state.lastResults = results;
    state.page        = 0;

    await sendResultsPage(chatId, state, loadMsg.message_id);
  } catch (err) {
    console.error('Search error:', err.message);
    const errText = (err.message || '').includes('429')
      ? '⏳ Tizim band. Biroz kuting.'
      : '😔 Qidirishda xatolik. Keyinroq qayta urinib ko\'ring.';
    await bot.editMessageText(errText, {
      chat_id: chatId, message_id: loadMsg.message_id
    }).catch(() => bot.sendMessage(chatId, errText));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DAILY QUOTE CRON — 9:00 AM UZT (04:00 UTC)
// ─────────────────────────────────────────────────────────────────────────────
cron.schedule('0 4 * * *', async () => {
  console.log('[CRON] Kunlik iqtiboslar yuborilmoqda...');
  let users = [];
  try {
    const data = await apiGet('/telegram/subscribers');
    users = data.users || [];
  } catch (err) {
    console.error('[CRON] Subscribers yuklanmadi:', err.message);
    return;
  }

  for (const user of users) {
    try {
      const lang = user.lang || 'uz';
      const data = await apiGet(`/telegram/daily-quote?lang=${lang}`);
      const quote = data.quote;
      if (!quote) continue;

      const book   = quote.bookId || {};
      const title  = esc(book.titleUz || book.title || '');
      const author = esc(book.author || '');
      const quoteText = esc(truncate(quote.text || '', 300));
      const searchQ   = encodeURIComponent((quote.text || '').slice(0, 80));
      const siteUrl   = `${FRONTEND}/search?q=${searchQ}`;

      let msg = `${t(lang, 'dailyTitle')}\n\n❝ <i>${quoteText}</i> ❞`;
      if (author || title) msg += `\n\n— ${author}${author && title ? ', ' : ''}${title ? `"${title}"` : ''}`;

      await bot.sendMessage(user.telegramId, msg, {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [[
            { text: '📚 Ko\'rish', url: siteUrl },
            { text: '📤 Do\'stga', switch_inline_query: (quote.text || '').slice(0, 60) }
          ]]
        }
      }).catch(() => {});

      await delay(150);
    } catch (err) {
      console.error(`[CRON] ${user.telegramId} ga yuborib bo\'lmadi:`, err.message);
    }
  }
  console.log(`[CRON] ${users.length} ta foydalanuvchiga yuborildi.`);
});

// ─────────────────────────────────────────────────────────────────────────────
// ERROR HANDLERS
// ─────────────────────────────────────────────────────────────────────────────
bot.on('polling_error', (err) => {
  if (err.code === 'ETELEGRAM' && String(err.message).includes('409')) {
    console.error('Bot boshqa joyda ishlamoqda (409). Polling to\'xtatildi.');
    process.exit(1);
  }
  console.error('Polling error:', err.message);
});

bot.on('error', (err) => console.error('Bot error:', err.message));

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason instanceof Error ? reason.message : reason);
});

process.on('SIGINT',  () => { bot.stopPolling && bot.stopPolling(); process.exit(0); });
process.on('SIGTERM', () => { bot.stopPolling && bot.stopPolling(); process.exit(0); });
