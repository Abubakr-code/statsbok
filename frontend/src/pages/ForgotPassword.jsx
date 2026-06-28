import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n';
import { useAuth } from '../hooks/useAuth';

export default function ForgotPassword() {
  const t = useI18n((s) => s.t);
  const lang = useI18n((s) => s.lang);
  const navigate = useNavigate();
  const { forgotPassword, resetPassword, loading } = useAuth();

  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ email: '', code: '', newPassword: '' });
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);

  async function handleRequest(e) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    try {
      await forgotPassword({ email: form.email, language: lang });
      setStep(2);
      setInfo(t('reset.sent'));
    } catch (err) {
      setError(err.message || t('common.error'));
    }
  }

  async function handleReset(e) {
    e.preventDefault();
    setError(null);
    if (form.newPassword.length < 6) {
      setError(t('common.error'));
      return;
    }
    try {
      await resetPassword({ email: form.email, code: form.code.trim(), newPassword: form.newPassword });
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message || t('common.error'));
    }
  }

  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-16">
      <h1 className="mb-8 text-center text-3xl text-parchment">{t('reset.title')}</h1>

      {step === 1 && (
        <form onSubmit={handleRequest} className="card space-y-4">
          <div>
            <label className="mb-1 block text-sm text-parchment-dim">{t('auth.email')}</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="input"
            />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? t('common.loading') : t('reset.send')}
          </button>
        </form>
      )}

      {step === 2 && (
        <form onSubmit={handleReset} className="card space-y-4">
          <div>
            <label className="mb-1 block text-sm text-parchment-dim">{t('verify.code')}</label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              required
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.replace(/\D/g, '') })}
              className="input text-center text-2xl tracking-[0.5em]"
              placeholder="••••••"
              autoFocus
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-parchment-dim">{t('reset.newPassword')}</label>
            <input
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              value={form.newPassword}
              onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
              className="input"
            />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          {info && <p className="text-sm text-amber">{info}</p>}
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? t('common.loading') : t('reset.button')}
          </button>
        </form>
      )}

      <p className="mt-4 text-center text-sm text-parchment-dim">
        <Link to="/login" className="text-amber hover:underline">
          {t('nav.login')}
        </Link>
      </p>
    </div>
  );
}
