import { useState, useEffect, useCallback } from 'react';
import { useI18n } from '../i18n';
import SaveButton from './SaveButton';
import { affiliateUrl } from '../services/affiliate';
import api from '../services/api';
import QuoteCardGenerator from './QuoteCardGenerator';

function ConfidenceStars({ confidence }) {
  const t = useI18n((s) => s.t);
  if (confidence == null) return null;
  const normalized = Math.max(0.01, Math.min(1, Number(confidence) || 0.75));
  const pct = Math.max(1, Math.round(normalized * 100));
  const filled = Math.max(1, Math.round(normalized * 5));
  return (
    <div className="flex items-center gap-1" title={`${pct}%`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <svg
          key={i}
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill={i <= filled ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth="1.5"
          className="text-amber"
          aria-hidden="true"
        >
          <path d="M12 2l2.9 6.3L22 9.2l-5 4.9 1.2 6.9L12 17.8 5.8 21l1.2-6.9-5-4.9 7.1-.9z" />
        </svg>
      ))}
      <span className="ml-1 text-xs text-parchment-faint">{t('search.match')}: {pct}%</span>
    </div>
  );
}

/**
 * Wrap query words found in the text with <mark>. Best-effort word match.
 */
function Highlighted({ text, query }) {
  if (!query) return <>{text}</>;
  const words = [...new Set(query.toLowerCase().split(/\s+/).filter((w) => w.length > 2))];
  if (words.length === 0) return <>{text}</>;
  const escaped = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const re = new RegExp(`(${escaped.join('|')})`, 'gi');
  const parts = text.split(re);
  return (
    <>
      {parts.map((part, i) =>
        re.test(part) ? (
          <mark key={i} className="rounded bg-amber/25 px-0.5 text-parchment">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

/**
 * A single result card. Works for both search results and the saved archive.
 *
 * Props:
 *  - quoteId, text, pageNumber, confidence, query
 *  - book: { id, title, titleUz, author, year, coverImage, affiliateLink }
 *  - variant: 'search' | 'archive'
 *  - onPreview(book), savedDate, onDelete(quoteId)
 */
export default function QuoteCard({
  quoteId,
  text,
  pageNumber,
  confidence,
  query,
  book,
  variant = 'search',
  source = 'database',
  savedDate,
  meta,
  onOrganize,
  onPreview,
  onDelete
}) {
  const t = useI18n((s) => s.t);
  const [likes, setLikes] = useState(book?.likes || 0);
  const [isLiked, setIsLiked] = useState(false);
  const [liking, setLiking] = useState(false);
  const [showGenerator, setShowGenerator] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => { setLikes(book?.likes || 0); }, [book?.likes]);

  const title = book?.titleUz || book?.title;
  const buyHref = book?.id ? affiliateUrl(book.id, quoteId) : book?.affiliateLink;

  const handleLike = async () => {
    if (!book?.id || liking) return;
    setLiking(true);
    try {
      if (isLiked) {
        await api.post(`/books/${book.id}/unlike`);
        setLikes((n) => Math.max(0, n - 1));
        setIsLiked(false);
      } else {
        await api.post(`/books/${book.id}/like`);
        setLikes((n) => n + 1);
        setIsLiked(true);
      }
    } catch (err) {
      console.error('Like error:', err);
    } finally {
      setLiking(false);
    }
  };

  const handleShare = useCallback(async () => {
    if (!quoteId || String(quoteId).startsWith('ai-')) return;
    const apiBase = (() => {
      const u = import.meta.env.VITE_API_URL || '/api';
      return u.startsWith('http') ? u.replace(/\/api\/?$/, '') : window.location.origin;
    })();
    const shareUrl = `${apiBase}/api/share/quote/${quoteId}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard access denied — fall back to prompt
      window.prompt('Linkni nusxalang:', shareUrl);
    }
  }, [quoteId]);

  return (
    <>
    {/* Toast */}
    {copied && (
      <div className="fixed bottom-6 left-1/2 z-[100] -translate-x-1/2 animate-fade-in rounded-xl bg-amber px-5 py-2.5 text-sm font-medium text-ink shadow-xl">
        🔗 Link nusxalandi!
      </div>
    )}
    <article className="card animate-fade-in flex flex-col gap-4 sm:flex-row">
      {book?.coverImage ? (
        <img
          src={book.coverImage}
          alt={title}
          className="h-40 w-28 flex-shrink-0 rounded-lg object-cover shadow-lg"
          loading="lazy"
        />
      ) : (
        <div className="flex h-40 w-28 flex-shrink-0 items-center justify-center rounded-lg bg-ink-700 text-parchment-faint">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M4 5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v16l-6-3-6 3z" />
          </svg>
        </div>
      )}

      <div className="flex flex-1 flex-col gap-3">
        <blockquote className="font-body text-lg leading-relaxed text-parchment">
          “<Highlighted text={text} query={query} />”
        </blockquote>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-parchment-dim">
          {title && <span className="font-display text-base text-parchment">{title}</span>}
          {book?.author && <span>· {book.author}</span>}
          {book?.year && <span>· {book.year}</span>}
          {pageNumber && <span>· {t('search.page', { n: pageNumber })}</span>}
          {likes > 0 && <span>· ❤️ {likes}</span>}
          {source === 'ai' && (
            <span className="rounded-full bg-purple-900/50 px-2 py-0.5 text-xs text-purple-200">
              {t('search.ai_result')}
            </span>
          )}
        </div>

        {variant === 'search' && <ConfidenceStars confidence={confidence} />}
        {variant === 'archive' && savedDate && (
          <span className="text-xs text-parchment-faint">
            {t('archive.savedOn')}: {new Date(savedDate).toLocaleDateString()}
          </span>
        )}

        {variant === 'archive' && (meta?.folder || (meta?.tags && meta.tags.length > 0)) && (
          <div className="flex flex-wrap items-center gap-1.5">
            {meta.folder && (
              <span className="rounded-md bg-amber/15 px-2 py-0.5 text-xs text-amber">
                📁 {meta.folder}
              </span>
            )}
            {(meta.tags || []).map((tag) => (
              <span key={tag} className="rounded-md bg-ink-700 px-2 py-0.5 text-xs text-parchment-dim">
                #{tag}
              </span>
            ))}
          </div>
        )}

        <div className="mt-1 flex flex-wrap items-center gap-2">
          {book && onPreview && (
            <button onClick={() => onPreview(book)} className="btn-ghost px-4 py-2 text-sm">
              {t('search.preview')}
            </button>
          )}
          {book && variant === 'search' && (
            <button
              onClick={handleLike}
              disabled={liking}
              className={`flex items-center gap-1 rounded-lg px-3 py-2 text-sm transition-colors disabled:opacity-60 ${
                isLiked
                  ? 'bg-red-900/30 text-red-400'
                  : 'bg-ink-700 text-parchment-dim hover:text-parchment'
              }`}
              title={isLiked ? 'Unlike this book' : 'Like this book'}
            >
              <span>{isLiked ? '❤️' : '🤍'}</span>
              <span>{likes > 0 ? likes : ''}</span>
            </button>
          )}
          {variant === 'search' && <SaveButton quoteId={quoteId} quoteData={source === 'ai' ? { text, book, confidence } : undefined} className="px-4 py-2 text-sm" />}
          {variant === 'archive' && onOrganize && (
            <button onClick={() => onOrganize(quoteId)} className="btn-ghost px-4 py-2 text-sm">
              {t('archive.organize')}
            </button>
          )}
          {variant === 'archive' && onDelete && (
            <button onClick={() => onDelete(quoteId)} className="btn-ghost px-4 py-2 text-sm">
              {t('quote.delete')}
            </button>
          )}
          {quoteId && !String(quoteId).startsWith('ai-') && (
            <button
              onClick={handleShare}
              className="flex items-center gap-1.5 rounded-lg border border-ink-600 bg-ink-700 px-3 py-2 text-sm text-parchment-dim hover:border-amber/40 hover:text-parchment transition-colors"
              title="Iqtibos havolasini nusxalash"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
                <path d="m8.59 13.51 6.83 3.98M15.41 6.51l-6.82 3.98" />
              </svg>
              Ulashish
            </button>
          )}
          {text && (
            <button
              onClick={() => setShowGenerator(true)}
              className="flex items-center gap-1.5 rounded-lg border border-ink-600 bg-ink-700 px-3 py-2 text-sm text-parchment-dim hover:border-amber/40 hover:text-parchment transition-colors"
              title="Stata kartasini yuklab olish"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="m21 15-5-5L5 21" />
              </svg>
              Karta
            </button>
          )}
          {buyHref && (
            <a
              href={buyHref}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary px-4 py-2 text-sm"
            >
              {t('search.buy')}
            </a>
          )}
        </div>
      </div>
    </article>
    {showGenerator && (
      <QuoteCardGenerator
        text={text}
        author={book?.author}
        bookTitle={title}
        bookId={book?.id}
        onClose={() => setShowGenerator(false)}
      />
    )}
    </>
  );
}
