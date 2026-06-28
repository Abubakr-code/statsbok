const { hasCyrillic } = require('./cyrillicConverter');
const { normalize } = require('./textNormalizer');

const UZ_CYRILLIC_RE = /[қғҳў]/i;
const RU_HINTS = new Set([
  'что', 'как', 'это', 'книга', 'книги', 'автор', 'найди', 'поиск', 'любовь', 'жизнь', 'цитата'
]);
const UZ_HINTS = new Set([
  'va', 'bilan', 'uchun', 'kitob', 'kitoblar', 'qidir', 'qidiruv', 'iqtibos', 'stata',
  'muallif', 'yozuvchi', 'hayot', 'sevgi', 'tog', 'toglar', "tog'lar", 'bagridan',
  "bag'ridan", 'hayqiraman', 'nima', 'qanday', 'manga', 'menga', 'uzbek', 'ozbek', "o'zbek",
  'navoiy', 'bobur', 'avloniy', 'qodiriy', 'cholpon', "cho'lpon", 'fitrat'
]);
const EN_HINTS = new Set([
  'the', 'and', 'book', 'books', 'author', 'quote', 'search', 'find', 'love', 'life',
  'what', 'how', 'why', 'recommend', 'novel', 'story', 'poem'
]);

function countHints(words, hints) {
  return words.reduce((sum, word) => sum + (hints.has(word) ? 1 : 0), 0);
}

function detectLanguage(text, fallback = 'en') {
  const raw = String(text || '').trim();
  if (!raw) return fallback || 'en';

  const normalized = normalize(raw);
  const words = normalized.split(/\s+/).filter(Boolean);

  if (hasCyrillic(raw)) {
    if (UZ_CYRILLIC_RE.test(raw)) return 'uz';
    const ruScore = countHints(words, RU_HINTS);
    const uzScore = countHints(words, UZ_HINTS);
    return uzScore > ruScore ? 'uz' : 'ru';
  }

  const uzScore = countHints(words, UZ_HINTS) + (/[qo]'|g'|o'|sh|ch/.test(normalized) ? 1 : 0);
  const enScore = countHints(words, EN_HINTS);
  if (uzScore > enScore) return 'uz';
  if (enScore > uzScore) return 'en';

  return fallback || 'en';
}

module.exports = { detectLanguage };
