/**
 * Text normalization used before search and before storing quotes.
 * - lowercases
 * - removes punctuation
 * - collapses whitespace
 * - optionally removes a small set of common stop words
 */

const EN_STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'of', 'to', 'in', 'on', 'at', 'for',
  'with', 'is', 'are', 'was', 'were', 'be', 'been', 'it', 'its', 'as', 'that',
  'this', 'by', 'from'
]);

/**
 * Normalize text for matching. Keeps letters/numbers/spaces and the
 * apostrophe (important for Uzbek Latin: o', g').
 * @param {string} text
 * @param {{ removeStopWords?: boolean }} [opts]
 * @returns {string}
 */
function normalize(text, opts = {}) {
  if (!text) return '';
  let out = String(text)
    .toLowerCase()
    // Unify the many apostrophe variants used in Uzbek Latin (oʻ, gʻ, o', o‘,
    // o’, o`) into one straight apostrophe so "o'tkir" and "oʻtkir" match.
    .replace(/[\u02bb\u02bc\u2018\u2019\u0060\u00b4]/g, "'")
    .replace(/[^\p{L}\p{N}\s']/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (opts.removeStopWords) {
    out = out
      .split(' ')
      .filter((w) => w && !EN_STOP_WORDS.has(w))
      .join(' ');
  }
  return out;
}

module.exports = { normalize, EN_STOP_WORDS };
