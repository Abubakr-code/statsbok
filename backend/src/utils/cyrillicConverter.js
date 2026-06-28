/**
 * Uzbek Cyrillic <-> Latin conversion.
 *
 * Note: order matters. Multi-letter Latin sequences (yo, yu, ya, ch, sh, ts)
 * are handled by iterating the Cyrillic map first. The reverse map handles
 * the common multi-character Latin tokens before single letters.
 */

// Cyrillic -> Latin.
const CYR_TO_LAT = {
  '\u0451': 'yo',
  '\u0436': 'j',
  '\u0447': 'ch',
  '\u0448': 'sh',
  '\u0446': 'ts',
  '\u044e': 'yu',
  '\u044f': 'ya',
  '\u0493': "g'",
  '\u049b': 'q',
  '\u04b3': 'h',
  '\u045e': "o'",
  '\u044a': "'",
  '\u0430': 'a',
  '\u0431': 'b',
  '\u0432': 'v',
  '\u0433': 'g',
  '\u0434': 'd',
  '\u0435': 'e',
  '\u0437': 'z',
  '\u0438': 'i',
  '\u0439': 'y',
  '\u043a': 'k',
  '\u043b': 'l',
  '\u043c': 'm',
  '\u043d': 'n',
  '\u043e': 'o',
  '\u043f': 'p',
  '\u0440': 'r',
  '\u0441': 's',
  '\u0442': 't',
  '\u0443': 'u',
  '\u0444': 'f',
  '\u0445': 'x',
  '\u044b': 'i',
  '\u044d': 'e'
};

function convertChar(ch) {
  const lower = ch.toLowerCase();
  const mapped = CYR_TO_LAT[lower];
  if (mapped === undefined) return ch;
  if (ch === lower) return mapped;
  if (mapped.length === 1) return mapped.toUpperCase();
  return mapped.charAt(0).toUpperCase() + mapped.slice(1);
}

/**
 * Convert Uzbek Cyrillic text to Latin.
 */
function cyrillicToLatin(text) {
  if (!text) return '';
  let out = '';
  for (const ch of text) out += convertChar(ch);
  return out;
}

const LAT_TO_CYR_MULTI = [
  ["o'", '\u045e'],
  ["g'", '\u0493'],
  ['yo', '\u0451'],
  ['yu', '\u044e'],
  ['ya', '\u044f'],
  ['ch', '\u0447'],
  ['sh', '\u0448'],
  ['ts', '\u0446']
];

const LAT_TO_CYR_SINGLE = {
  a: '\u0430',
  b: '\u0431',
  v: '\u0432',
  g: '\u0433',
  d: '\u0434',
  e: '\u0435',
  j: '\u0436',
  z: '\u0437',
  i: '\u0438',
  y: '\u0439',
  k: '\u043a',
  l: '\u043b',
  m: '\u043c',
  n: '\u043d',
  o: '\u043e',
  p: '\u043f',
  r: '\u0440',
  s: '\u0441',
  t: '\u0442',
  u: '\u0443',
  f: '\u0444',
  x: '\u0445',
  q: '\u049b',
  h: '\u04b3',
  "'": '\u044a'
};

/**
 * Convert Uzbek Latin text to Cyrillic (best effort).
 */
function latinToCyrillic(text) {
  if (!text) return '';
  const lower = text;
  let i = 0;
  let out = '';
  while (i < lower.length) {
    const two = lower.substr(i, 2).toLowerCase();
    const multi = LAT_TO_CYR_MULTI.find(([k]) => k === two);
    if (multi) {
      const isUpper = lower[i] === lower[i].toUpperCase() && lower[i] !== lower[i].toLowerCase();
      out += isUpper ? multi[1].toUpperCase() : multi[1];
      i += 2;
      continue;
    }
    const ch = lower[i];
    const single = LAT_TO_CYR_SINGLE[ch.toLowerCase()];
    if (single) {
      const isUpper = ch === ch.toUpperCase() && ch !== ch.toLowerCase();
      out += isUpper ? single.toUpperCase() : single;
    } else {
      out += ch;
    }
    i += 1;
  }
  return out;
}

/**
 * Does the string contain any Cyrillic characters?
 */
function hasCyrillic(text) {
  return /[\u0400-\u04FF]/.test(text || '');
}

module.exports = { cyrillicToLatin, latinToCyrillic, hasCyrillic };
