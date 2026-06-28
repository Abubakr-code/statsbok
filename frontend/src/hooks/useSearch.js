import { useCallback } from 'react';
import { useQuotesStore } from '../store/quotesStore';
import { useI18n } from '../i18n';

/**
 * Search hook. Uses the current UI language as the search language hint.
 */
export function useSearch() {
  const lang = useI18n((s) => s.lang);
  const results = useQuotesStore((s) => s.results);
  const loading = useQuotesStore((s) => s.searchLoading);
  const error = useQuotesStore((s) => s.searchError);
  const query = useQuotesStore((s) => s.query);
  const doSearch = useQuotesStore((s) => s.search);

  const search = useCallback((q) => doSearch(q, lang), [doSearch, lang]);

  return { results, loading, error, query, search };
}
