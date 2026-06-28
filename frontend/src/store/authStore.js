import { create } from 'zustand';
import { authService } from '../services/auth';

/**
 * Auth state. The session lives in an httpOnly cookie; this store only holds
 * the in-memory user object plus a "checked" flag so the UI knows when the
 * initial /auth/me probe has finished.
 */
export const useAuthStore = create((set, get) => ({
  user: null,
  checked: false,
  loading: false,
  error: null,

  isPremium: () => {
    const u = get().user;
    return Boolean(u && u.plan === 'premium' && u.premiumUntil && new Date(u.premiumUntil) > new Date());
  },

  // Called once on app load to restore the session from the cookie.
  init: async () => {
    try {
      const user = await authService.me();
      set({ user, checked: true });
    } catch {
      set({ user: null, checked: true });
    }
  },

  login: async (credentials) => {
    set({ loading: true, error: null });
    try {
      const user = await authService.login(credentials);
      set({ user, loading: false });
      return user;
    } catch (err) {
      set({ loading: false, error: err.message });
      throw err;
    }
  },

  // Returns { needsVerification, email, dev }. No user/session until verified.
  register: async (payload) => {
    set({ loading: true, error: null });
    try {
      const data = await authService.register(payload);
      set({ loading: false });
      return data;
    } catch (err) {
      set({ loading: false, error: err.message });
      throw err;
    }
  },

  verify: async ({ email, code }) => {
    set({ loading: true, error: null });
    try {
      const user = await authService.verify({ email, code });
      set({ user, loading: false });
      return user;
    } catch (err) {
      set({ loading: false, error: err.message });
      throw err;
    }
  },

  resendCode: (payload) => authService.resendCode(payload),

  forgotPassword: (payload) => authService.forgotPassword(payload),

  resetPassword: async (payload) => {
    set({ loading: true, error: null });
    try {
      const user = await authService.resetPassword(payload);
      set({ user, loading: false });
      return user;
    } catch (err) {
      set({ loading: false, error: err.message });
      throw err;
    }
  },

  googleLogin: async (credential) => {
    set({ loading: true, error: null });
    try {
      const user = await authService.google(credential);
      set({ user, loading: false });
      return user;
    } catch (err) {
      set({ loading: false, error: err.message });
      throw err;
    }
  },

  logout: async () => {
    try {
      await authService.logout();
    } finally {
      set({ user: null });
    }
  },

  // Patch the cached user after profile/premium changes.
  setUser: (user) => set({ user })
}));
