import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n';
import { useSavedQuotes } from '../hooks/useSavedQuotes';
import { useAuth } from '../hooks/useAuth';

/**
 * Save / unsave a quote. Redirects to login if anonymous and surfaces the
 * free-plan limit error from the backend.
 */
export default function SaveButton({ quoteId, quoteData, className = '' }) {
  const t = useI18n((s) => s.t);
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { isSaved, toggle } = useSavedQuotes();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const saved = isSaved(quoteId);

  async function handleClick() {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await toggle(quoteId, quoteData);
    } catch (err) {
      setError(err.message || t('common.error'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        className={`btn ${saved ? 'bg-amber/15 text-amber' : 'btn-ghost'} ${className}`}
        title={!isAuthenticated ? t('quote.login_required') : undefined}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill={saved ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
        </svg>
        {saved ? t('quote.saved') : t('quote.save')}
      </button>
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  );
}
