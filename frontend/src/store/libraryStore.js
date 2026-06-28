import { create } from 'zustand';
import api from '../services/api';

export const useLibraryStore = create((set, get) => ({
  books: [],
  loading: false,
  error: null,
  activeShelf: 'all',
  stats: null,
  goal: null,

  setShelf: (shelf) => set({ activeShelf: shelf }),

  fetchBooks: async (params = {}) => {
    set({ loading: true, error: null });
    try {
      const { data } = await api.get('/library', { params });
      set({ books: data.books || [], loading: false });
    } catch (err) {
      set({ error: err.response?.data?.message || err.message, loading: false });
    }
  },

  addBook: async (payload) => {
    const { data } = await api.post('/library', payload);
    set((s) => ({ books: [data.book, ...s.books] }));
    return data.book;
  },

  updateBook: async (id, payload) => {
    const { data } = await api.put(`/library/${id}`, payload);
    set((s) => ({ books: s.books.map((b) => (b._id === id ? data.book : b)) }));
    return data.book;
  },

  deleteBook: async (id) => {
    await api.delete(`/library/${id}`);
    set((s) => ({ books: s.books.filter((b) => b._id !== id) }));
  },

  changeShelf: async (id, shelf) => {
    const { data } = await api.patch(`/library/${id}/shelf`, { shelf });
    set((s) => ({ books: s.books.map((b) => (b._id === id ? data.book : b)) }));
    return data.book;
  },

  fetchStats: async () => {
    try {
      const { data } = await api.get('/library/stats');
      set({ stats: data });
    } catch {}
  },

  fetchGoal: async (year) => {
    try {
      const y = year || new Date().getFullYear();
      const { data } = await api.get(`/library/goal/${y}`);
      set({ goal: data });
    } catch {}
  },

  setGoal: async (payload) => {
    const { data } = await api.post('/library/goal', payload);
    set({ goal: { goal: data.goal } });
  }
}));
