import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n';
import { useAuth } from '../hooks/useAuth';

export default function Verify() {
  const t = useI18n((s) => s.t);
  const lang = useI18n((s) => s.lang);
  const navigate = useNavigate();
  const location = useLocation();
  const { verify, resendCode, loading } = useAuth();

  const channel = 'email';
  const value = location.state?.value;
  const deliveredTo = location.state?.deliveredTo || value;
  const redirected = Boolean(location.state?.redirected && deliveredTo && value && deliveredTo !== value);
  const restricted = Boolean(location.state?.restricted);
  const [code, setCode] = useState('');
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(
    redirected
      ? `Tasdiqlash kodi test inboxga yuborildi: ${deliveredTo}`
      : restricted
      ? "Email provider test rejimida. Domenni tasdiqlagach kod to'g'ridan-to'g'ri emailingizga boradi."
      : location.state?.dev
        ? t('verify.dev')
        : null
  );

  if (!value) return <Navigate to="/register" replace />;

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    try {
      await verify({ [channel]: value, code: code.trim() });
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message || t('common.error'));
    }
  }

  async function handleResend() {
    setError(null);
    setInfo(null);
    try {
      const res = await resendCode({ [channel]: value, language: lang });
      if (res?.redirected && res?.deliveredTo) {
        setInfo(`Tasdiqlash kodi test inboxga yuborildi: ${res.deliveredTo}`);
      } else if (res?.restricted) {
        setInfo("Email provider test rejimida. Domen tasdiqlansa kod emailingizga tushadi.");
      } else {
        setInfo(res?.dev ? t('verify.dev') : t('verify.resent'));
      }
    } catch (err) {
      setError(err.message || t('common.error'));
    }
  }

  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-16">
      <h1 className="mb-3 text-center text-3xl text-parchment">{t('verify.title')}</h1>
      <p className="mb-8 text-center text-sm text-parchment-dim">
        {t('verify.text', { email: deliveredTo || value })}
      </p>

      <form onSubmit={handleSubmit} className="card space-y-4">
        <div>
          <label className="mb-1 block text-sm text-parchment-dim">{t('verify.code')}</label>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            required
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            className="input text-center text-2xl tracking-[0.5em]"
            placeholder="••••••"
            autoFocus
          />
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}
        {info && <p className="text-sm text-amber">{info}</p>}

        <button type="submit" disabled={loading || code.length < 6} className="btn-primary w-full">
          {loading ? t('common.loading') : t('verify.button')}
        </button>
        <button type="button" onClick={handleResend} className="btn-ghost w-full">
          {t('verify.resend')}
        </button>
      </form>
    </div>
  );
}
