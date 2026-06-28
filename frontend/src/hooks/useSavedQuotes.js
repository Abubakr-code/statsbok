import { useCallback } from 'react';
import { useQuotesStore } from '../store/quotesStore';
import { useAuth } from './useAuth';

/**
 * Saved-quotes hook. Wraps the store and exposes a single toggle() that
 * decides whether to save or unsave based on current state.
 */
export function useSavedQuotes() {
  const { isAuthenticated } = useAuth();
  const saved = useQuotesStore((s) => s.saved);
  const savedIds = useQuotesStore((s) => s.savedIds);
  const savedMeta = useQuotesStore((s) => s.savedMeta);
  const savedLimit = useQuotesStore((s) => s.savedLimit);
  const loading = useQuotesStore((s) => s.savedLoading);
  const load = useQuotesStore((s) => s.loadSaved);
  const saveQuote = useQuotesStore((s) => s.saveQuote);
  const unsaveQuote = useQuotesStore((s) => s.unsaveQuote);
  const setQuoteMeta = useQuotesStore((s) => s.setQuoteMeta);
  const isSaved = useQuotesStore((s) => s.isSaved);

  const toggle = useCallback(
    async (quoteId, quoteData) => {
      if (!isAuthenticated) throw new Error('AUTH_REQUIRED');
      if (isSaved(quoteId)) {
        await unsaveQuote(quoteId);
        return false;
      }
      await saveQuote(quoteId, quoteData);
      return true;
    },
    [isAuthenticated, isSaved, saveQuote, unsaveQuote]
  );

  return {
    saved,
    savedIds,
    savedMeta,
    savedCount: savedIds.length,
    savedLimit,
    loading,
    load,
    toggle,
    setQuoteMeta,
    isSaved
  };
}
