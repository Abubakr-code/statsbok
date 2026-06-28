import { useAuthStore } from '../store/authStore';

/**
 * Convenience hook over the auth store. Components can pull only what they
 * need; Zustand handles re-render subscriptions.
 */
export function useAuth() {
  const user = useAuthStore((s) => s.user);
  const checked = useAuthStore((s) => s.checked);
  const loading = useAuthStore((s) => s.loading);
  const error = useAuthStore((s) => s.error);
  const login = useAuthStore((s) => s.login);
  const register = useAuthStore((s) => s.register);
  const verify = useAuthStore((s) => s.verify);
  const resendCode = useAuthStore((s) => s.resendCode);
  const forgotPassword = useAuthStore((s) => s.forgotPassword);
  const resetPassword = useAuthStore((s) => s.resetPassword);
  const googleLogin = useAuthStore((s) => s.googleLogin);
  const logout = useAuthStore((s) => s.logout);
  const isPremium = useAuthStore((s) => s.isPremium);

  return {
    user,
    checked,
    loading,
    error,
    isAuthenticated: Boolean(user),
    isPremium: isPremium(),
    login,
    register,
    verify,
    resendCode,
    forgotPassword,
    resetPassword,
    googleLogin,
    logout
  };
}
