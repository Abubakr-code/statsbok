import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n';
import { useAuth } from '../hooks/useAuth';
import api from '../services/api';
import SEO from '../components/SEO';

function Check({ ok }) {
  return ok ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-amber">
      <path d="M5 13l4 4L19 7" />
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-parchment-faint">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

/**
 * Build a provider checkout redirect URL. Merchant identifiers come from
 * build-time env vars; if they are not configured we fall back to showing
 * the created order id so the dev can wire the real redirect later.
 */
function paymeUrl(orderId, amountUzs) {
  const merchant = import.meta.env.VITE_PAYME_MERCHANT_ID;
  if (!merchant) return null;
  const payload = `m=${merchant};ac.order_id=${orderId};a=${amountUzs * 100}`;
  return `https://checkout.paycom.uz/${btoa(payload)}`;
}

function clickUrl(orderId, amountUzs) {
  const serviceId = import.meta.env.VITE_CLICK_SERVICE_ID;
  const merchantId = import.meta.env.VITE_CLICK_MERCHANT_ID;
  if (!serviceId || !merchantId) return null;
  return `https://my.click.uz/services/pay?service_id=${serviceId}&merchant_id=${merchantId}&amount=${amountUzs}&transaction_param=${orderId}`;
}

export default function Premium() {
  const t = useI18n((s) => s.t);
  const { isAuthenticated, isPremium, user } = useAuth();
  const [busy, setBusy] = useState(null);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  async function pay(provider) {
    if (!isAuthenticated) {
      setError(t('premium.login_required'));
      return;
    }
    setBusy(provider);
    setError(null);
    setMessage(null);
    try {
      const { data } = await api.post('/payments/premium-order', { provider });
      const url =
        provider === 'payme'
          ? paymeUrl(data.orderId, data.amount)
          : clickUrl(data.orderId, data.amount);
      if (url) {
        window.location.href = url;
      } else {
        setMessage('To‘lov tizimi hali ulanmagan. Iltimos, birozdan so‘ng qayta urinib ko‘ring.');
      }
    } catch (err) {
      setError(err.message || t('common.error'));
    } finally {
      setBusy(null);
    }
  }

  const features = [
    { key: 'premium.feature.saves.free', free: true, premium: false, alt: 'premium.feature.saves.premium' },
    { key: 'premium.feature.ai', free: false, premium: true },
    { key: 'premium.feature.export', free: false, premium: true },
    { key: 'premium.feature.support', free: false, premium: true }
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <SEO title="Premium" description="StatBooks Premium — cheksiz saqlash, AI tavsiyalar va ko'proq narsa uchun." />
      <div className="mb-10 text-center">
        <h1 className="mb-2 text-4xl text-parchment">{t('premium.title')}</h1>
        <p className="text-lg text-parchment-dim">{t('premium.subtitle')}</p>
      </div>

      {isPremium && (
        <div className="card mb-8 border-amber/40 text-center text-amber">
          {t('premium.active', {
            date: user?.premiumUntil ? new Date(user.premiumUntil).toLocaleDateString() : ''
          })}
        </div>
      )}

      <div className="grid gap-6 sm:grid-cols-2">
        {/* Free plan */}
        <div className="card">
          <h2 className="mb-1 text-2xl text-parchment">{t('premium.free')}</h2>
          <p className="mb-6 text-3xl font-display text-parchment">$0</p>
          <ul className="space-y-3 text-sm">
            <li className="flex items-center gap-2">
              <Check ok /> <span className="text-parchment-dim">{t('premium.feature.saves.free')}</span>
            </li>
            {features.slice(1).map((f) => (
              <li key={f.key} className="flex items-center gap-2">
                <Check ok={f.free} />
                <span className="text-parchment-faint">{t(f.key)}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Premium plan */}
        <div className="card relative border-amber/40 ring-1 ring-amber/30">
          <span className="absolute -top-3 right-4 rounded-full bg-amber px-3 py-0.5 text-xs font-medium text-ink">
            $3 / {t('premium.subtitle').includes('oy') ? 'oy' : 'mo'}
          </span>
          <h2 className="mb-1 text-2xl text-parchment">{t('premium.premium')}</h2>
          <p className="mb-6 text-3xl font-display text-amber">$3<span className="text-base text-parchment-dim">/mo</span></p>
          <ul className="mb-6 space-y-3 text-sm">
            <li className="flex items-center gap-2">
              <Check ok /> <span className="text-parchment">{t('premium.feature.saves.premium')}</span>
            </li>
            {features.slice(1).map((f) => (
              <li key={f.key} className="flex items-center gap-2">
                <Check ok={f.premium} />
                <span className="text-parchment">{t(f.key)}</span>
              </li>
            ))}
          </ul>

          {!isPremium && (
            <div className="space-y-3">
              <button
                onClick={() => pay('payme')}
                disabled={!!busy}
                className="btn-primary w-full"
              >
                {busy === 'payme' ? t('common.loading') : t('premium.pay.payme')}
              </button>
              <button
                onClick={() => pay('click')}
                disabled={!!busy}
                className="btn-ghost w-full"
              >
                {busy === 'click' ? t('common.loading') : t('premium.pay.click')}
              </button>
            </div>
          )}

          {!isAuthenticated && (
            <p className="mt-3 text-center text-xs text-parchment-faint">
              <Link to="/login" className="text-amber hover:underline">
                {t('nav.login')}
              </Link>
            </p>
          )}
        </div>
      </div>

      {message && <p className="mt-6 text-center text-sm text-amber">{message}</p>}
      {error && <p className="mt-6 text-center text-sm text-red-400">{error}</p>}
    </div>
  );
}
