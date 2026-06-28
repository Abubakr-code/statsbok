import axios from 'axios';

/**
 * Shared axios instance.
 * - baseURL defaults to "/api" so the Vite dev proxy (and same-domain prod)
 *   handle routing to the backend.
 * - withCredentials sends the httpOnly auth cookie on every request.
 */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' }
});

// Normalize error messages so the UI can show a clean string.
api.interceptors.response.use(
  (res) => res,
  (error) => {
    error.message =
      error.response?.data?.error ||
      error.response?.data?.message ||
      error.message ||
      'Network error';
    error.status = error.response?.status;
    error.data = error.response?.data;
    return Promise.reject(error);
  }
);

export default api;
