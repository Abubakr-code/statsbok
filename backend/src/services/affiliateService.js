/**
 * Affiliate link helpers.
 *
 * - Amazon Associates: append our tracking tag (?tag=) to product/search URLs.
 * - Kitoblar.uz (Uzbek partner): use the stored link as-is.
 * - Fallback: an Amazon search for the book so the link is never dead.
 */
const AMAZON_TAG = process.env.AMAZON_ASSOC_TAG || '';

function detectProvider(url) {
  if (!url) return 'unknown';
  if (/amazon\./i.test(url)) return 'amazon';
  if (/kitob/i.test(url)) return 'kitoblar';
  return 'other';
}

function withAmazonTag(url) {
  if (!AMAZON_TAG || !/amazon\./i.test(url)) return url;
  if (/[?&]tag=/.test(url)) return url;
  return url + (url.includes('?') ? '&' : '?') + 'tag=' + encodeURIComponent(AMAZON_TAG);
}

/**
 * Resolve the outbound URL + provider for a book.
 * @param {object} book - Mongoose lean book ({ title, author, affiliateLink })
 */
function resolveAffiliate(book) {
  if (book?.affiliateLink) {
    const provider = detectProvider(book.affiliateLink);
    const url = provider === 'amazon' ? withAmazonTag(book.affiliateLink) : book.affiliateLink;
    return { url, provider };
  }
  // No stored link: build an Amazon search (with tag if available).
  const q = encodeURIComponent([book?.title, book?.author].filter(Boolean).join(' '));
  const url = withAmazonTag(`https://www.amazon.com/s?k=${q}`);
  return { url, provider: 'amazon_search' };
}

module.exports = { resolveAffiliate, detectProvider };
