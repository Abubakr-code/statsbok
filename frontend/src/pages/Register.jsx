import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n';
import { useAuth } from '../hooks/useAuth';
import GoogleButton from '../components/GoogleButton';

export default function Register() {
  const t = useI18n((s) => s.t);
  const lang = useI18n((s) => s.lang);
  const navigate = useNavigate();
  const { register, loading } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState(null);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    if (form.password.length < 6) {
      setError(t('common.error'));
      return;
    }
    const payload = {
      email: form.email,
      password: form.password,
      name: form.name,
      language: lang
    };
    try {
      const data = await register(payload);
      // Demo mode: the backend signed us in directly (no email code) — go home.
      if (data && data.user) {
        navigate('/', { replace: true });
        return;
      }
      navigate('/verify', {
        state: {
          channel: 'email',
          value: data.email || form.email,
          dev: data.dev,
          restricted: data.restricted,
          redirected: data.redirected,
          deliveredTo: data.deliveredTo
        }
      });
    } catch (err) {
      setError(err.message || t('common.error'));
    }
  }

  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-16">
      <h1 className="mb-2 text-center text-3xl text-parchment">{t('auth.register.title')}</h1>
      <p className="mb-8 text-center text-xs text-parchment-faint">{t('auth.register.demoNote')}</p>

      <form onSubmit={handleSubmit} className="card space-y-4">
        <div>
          <label className="mb-1 block text-sm text-parchment-dim">{t('auth.name')}</label>
          <input
            type="text"
            autoComplete="name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="input"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm text-parchment-dim">{t('auth.email')}</label>
          <input
            type="email"
            required
            autoComplete="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="input"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm text-parchment-dim">{t('auth.password')}</label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              required
              minLength={6}
              autoComplete="new-password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="input pr-12"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-2 text-parchment-faint hover:bg-ink-700 hover:text-parchment"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 3l18 18M10.6 10.6A3 3 0 0 0 12 16a3 3 0 0 0 2.8-2M9.9 4.2A10.9 10.9 0 0 1 12 4c5 0 9.3 3.1 11 8-0.5 1.4-1.3 2.7-2.3 3.8M6.2 6.2C4.4 7.6 3 9.6 2 12c1.7 4.9 6 8 10 8 1.6 0 3.2-.5 4.6-1.2" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? t('common.loading') : t('auth.register.button')}
        </button>

        <div className="flex items-center gap-3 py-1 text-xs text-parchment-faint">
          <span className="h-px flex-1 bg-ink-600" />
          {t('auth.or')}
          <span className="h-px flex-1 bg-ink-600" />
        </div>

        <GoogleButton onError={setError} />
      </form>

      <p className="mt-4 text-center text-sm text-parchment-dim">
        {t('auth.register.alt')}{' '}
        <Link to="/login" className="text-amber hover:underline">
          {t('nav.login')}
        </Link>
      </p>
    </div>
  );
}
