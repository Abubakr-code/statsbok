// Build the tracked outbound link. Hitting this endpoint records the click
// (which quote drove the sale) and 302-redirects to the partner store.
const API_BASE = import.meta.env.VITE_API_URL || '/api';

export function affiliateUrl(bookId, quoteId) {
  if (!bookId) return null;
  const params = new URLSearchParams({ bookId: String(bookId) });
  if (quoteId) params.set('quoteId', String(quoteId));
  return `${API_BASE}/affiliate/go?${params.toString()}`;
}
