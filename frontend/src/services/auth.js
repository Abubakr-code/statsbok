import api from './api';

/**
 * Auth API calls. The backend sets/clears an httpOnly cookie, so these
 * functions just return the user payload.
 */
export const authService = {
  // Returns { needsVerification, channel, email, dev } - no session yet.
  async register(payload) {
    const { data } = await api.post('/auth/register', payload);
    return data;
  },

  async verify(payload) {
    const { data } = await api.post('/auth/verify', payload);
    return data.user;
  },

  async resendCode(payload) {
    const { data } = await api.post('/auth/resend-code', payload);
    return data;
  },

  async login(payload) {
    const { data } = await api.post('/auth/login', payload);
    return data.user;
  },

  async forgotPassword(payload) {
    const { data } = await api.post('/auth/forgot-password', payload);
    return data;
  },

  async resetPassword(payload) {
    const { data } = await api.post('/auth/reset-password', payload);
    return data.user;
  },

  async google(payload) {
    const body = typeof payload === 'string' ? { credential: payload } : payload;
    const { data } = await api.post('/auth/google', body);
    return data.user;
  },

  async logout() {
    await api.post('/auth/logout');
  },

  async me() {
    const { data } = await api.get('/auth/me');
    return data.user;
  }
};
