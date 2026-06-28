import { Link, useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n';

export default function NotFound() {
  const navigate = useNavigate();
  const t = useI18n((s) => s.t);

  return (
    <div className="relative mx-auto flex min-h-[70vh] max-w-4xl items-center justify-center overflow-hidden px-4 py-16 text-center">
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            'radial-gradient(50% 45% at 50% 35%, rgba(232,169,74,0.18) 0%, rgba(26,24,20,0) 70%)'
        }}
      />

      <div className="relative">
        <div className="mx-auto mb-8 flex h-28 w-28 items-center justify-center rounded-3xl border border-amber/30 bg-amber/10 shadow-2xl shadow-amber/10">
          <svg width="54" height="54" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" className="text-amber">
            <path d="M4 5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v16l-6-3-6 3z" />
            <path d="M8 7h5M8 11h7M8 15h4" />
          </svg>
        </div>

        <p className="mb-3 font-display text-7xl text-amber sm:text-8xl">404</p>
        <h1 className="mb-4 text-3xl text-parchment sm:text-4xl">{t('notfound.title')}</h1>
        <p className="mx-auto mb-8 max-w-xl text-parchment-dim">
          {t('notfound.text')}
        </p>

        <div className="flex flex-wrap justify-center gap-3">
          <Link to="/" className="btn-primary px-5 py-2.5">
            {t('notfound.home')}
          </Link>
          <button type="button" onClick={() => navigate(-1)} className="btn-ghost px-5 py-2.5">
            {t('notfound.back')}
          </button>
        </div>

        <div className="mt-10 rounded-2xl border border-ink-600 bg-ink-800/60 p-4 text-left">
          <p className="text-sm text-parchment-faint">{t('notfound.hint.title')}</p>
          <p className="mt-1 text-parchment-dim">
            {t('notfound.hint.text')}
          </p>
        </div>
      </div>
    </div>
  );
}
