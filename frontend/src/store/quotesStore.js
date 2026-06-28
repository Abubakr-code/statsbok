import { create } from 'zustand';
import api from '../services/api';

/**
 * Search + saved-quotes state.
 * Saved quote IDs are kept in a Set-like array so QuoteCard can show the
 * correct save/unsave state instantly across pages.
 */
export const useQuotesStore = create((set, get) => ({
  query: '',
  results: [],
  searchLoading: false,
  searchError: null,

  savedIds: [],
  saved: [],
  savedMeta: {},
  savedLimit: null,
  savedLoading: false,

  setQuery: (query) => set({ query }),

  search: async (q, lang) => {
    set({ searchLoading: true, searchError: null, query: q });
    try {
      const { data } = await api.get('/quotes/search', { params: { q, lang } });
      set({ results: data.results || [], searchLoading: false });
      return data.results || [];
    } catch (err) {
      set({ searchLoading: false, searchError: err.message, results: [] });
      throw err;
    }
  },

  loadSaved: async () => {
    set({ savedLoading: true });
    try {
      const { data } = await api.get('/users/saved-quotes');
      const quotes = data.quotes || [];
      set({
        saved: quotes,
        savedIds: quotes.map((q) => String(q._id)),
        savedMeta: data.meta || {},
        savedLimit: data.limit ?? null,
        savedLoading: false
      });
    } catch {
      set({ savedLoading: false });
    }
  },

  isSaved: (quoteId) => get().savedIds.includes(String(quoteId)),

  saveQuote: async (quoteId, quoteData) => {
    // For AI quotes, send full quote data along with the ID
    await api.post(`/users/save-quote/${quoteId}`, quoteData || {});
    set((s) => ({ savedIds: [...new Set([...s.savedIds, String(quoteId)])] }));
  },

  unsaveQuote: async (quoteId) => {
    await api.delete(`/users/save-quote/${quoteId}`);
    set((s) => ({
      savedIds: s.savedIds.filter((id) => id !== String(quoteId)),
      saved: s.saved.filter((q) => String(q._id) !== String(quoteId))
    }));
  },

  setQuoteMeta: async (quoteId, folder, tags) => {
    const { data } = await api.patch(`/users/save-quote/${quoteId}/meta`, { folder, tags });
    set((s) => ({
      savedMeta: { ...s.savedMeta, [String(quoteId)]: { folder: data.folder, tags: data.tags } }
    }));
    return data;
  },

  clearSaved: () => set({ saved: [], savedIds: [], savedMeta: {}, savedLimit: null })
}));
