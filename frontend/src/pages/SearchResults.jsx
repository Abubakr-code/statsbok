import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n';
import { useSearch } from '../hooks/useSearch';
import api from '../services/api';
import SearchBar from '../components/SearchBar';
import BookPreviewModal from '../components/BookPreviewModal';
import SaveButton from '../components/SaveButton';
import { affiliateUrl } from '../services/affiliate';
import QuoteCardGenerator from '../components/QuoteCardGenerator';
import SEO from '../components/SEO';

function normalizeConfidence(value, fallback = 0.75) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0.01, Math.min(1, n));
}

function confidencePercent(value, fallback = 0.75) {
  return Math.max(1, Math.min(100, Math.round(normalizeConfidence(value, fallback) * 100)));
}

function ResultSkeleton() {
  return (
    <div className="card flex gap-4">
      <div className="skeleton h-48 w-32 flex-shrink-0 rounded-lg" />
      <div className="flex-1 space-y-3">
        <div className="skeleton h-5 w-3/4" />
        <div className="skeleton h-4 w-1/2" />
        <div className="skeleton h-4 w-full" />
        <div className="skeleton h-4 w-5/6" />
        <div className="skeleton h-10 w-36" />
      </div>
    </div>
  );
}

function BookResultCard({ result, query, expanded, onToggle, onPreview }) {
  const t = useI18n((s) => s.t);
  const { book, text, quoteId, confidence, source } = result;
  const title = book?.title || '';
  const author = book?.author || '';
  const cover = book?.coverImage;
  const [likes, setLikes] = useState(book?.likes || 0);
  const [isLiked, setIsLiked] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [showGenerator, setShowGenerator] = useState(false);

  const normalizedConfidence = normalizeConfidence(confidence, 0.75);
  const confidencePct = confidencePercent(confidence, 0.75);
  const filled = Math.max(1, Math.round(normalizedConfidence * 5));
  const hasLongText = text && text.length > 160;

  const handleLike = async () => {
    if (!book?.id) return;
    try {
      if (isLiked) {
        await api.post(`/books/${book.id}/unlike`);
        setLikes(Math.max(0, likes - 1));
        setIsLiked(false);
      } else {
        await api.post(`/books/${book.id}/like`);
        setLikes(likes + 1);
        setIsLiked(true);
      }
    } catch (err) {
      console.error('Like error:', err);
    }
  };

  return (
    <>
    <article
      className={`card animate-fade-in flex flex-col gap-4 transition-all duration-200 sm:flex-row ${
        expanded ? 'border-amber/40 shadow-lg shadow-amber/5' : 'hover:border-amber/30'
      }`}
    >
      {/* Book Cover — clicking it toggles the card open/closed */}
      <button
        type="button"
        onClick={onToggle}
        className="mx-auto flex-shrink-0 sm:mx-0"
        aria-expanded={expanded}
      >
        {cover && !imgError ? (
          <img
            src={cover}
            alt={title}
            className="h-44 w-28 rounded-lg object-cover shadow-lg sm:h-48 sm:w-32"
            loading="lazy"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="flex h-44 w-28 flex-col items-center justify-center rounded-lg border border-ink-600 bg-gradient-to-br from-ink-700 to-ink-800 text-parchment-faint sm:h-48 sm:w-32">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M4 5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v16l-6-3-6 3z" />
            </svg>
            <span className="mt-2 line-clamp-2 px-1 text-center text-xs">{title}</span>
          </div>
        )}
      </button>

      {/* Info */}
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <button type="button" onClick={onToggle} className="flex items-start justify-between gap-2 text-left" aria-expanded={expanded}>
          <div className="min-w-0">
            <h3 className="font-display text-lg leading-tight text-parchment sm:text-xl">{title}</h3>
            <p className="text-sm text-parchment-dim">{author}</p>
            {book?.year && <p className="text-xs text-parchment-faint">{book.year}</p>}
          </div>
          <svg
            width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            className={`mt-1 flex-shrink-0 text-parchment-faint transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>

        {text && (
          <p
            className={`text-sm italic leading-relaxed text-parchment-dim ${expanded ? '' : 'line-clamp-3'}`}
          >
            {text}
          </p>
        )}

        {hasLongText && (
          <button
            type="button"
            onClick={onToggle}
            className="self-start text-xs font-medium text-amber transition-colors hover:text-amber-300"
          >
            {expanded ? t('search.readLess') : t('search.readMore')}
          </button>
        )}

        <div className="mt-1 flex flex-wrap items-center gap-3">
          {/* Confidence stars */}
          <div className="flex items-center gap-0.5" title={`${confidencePct}% ${t('search.match')}`}>
            {[1, 2, 3, 4, 5].map((i) => (
              <svg
                key={i}
                width="14" height="14" viewBox="0 0 24 24"
                fill={i <= filled ? 'currentColor' : 'none'}
                stroke="currentColor" strokeWidth="1.5"
                className="text-amber"
              >
                <path d="M12 2l2.9 6.3L22 9.2l-5 4.9 1.2 6.9L12 17.8 5.8 21l1.2-6.9-5-4.9 7.1-.9z" />
              </svg>
            ))}
          </div>

          <span className="text-xs text-parchment-faint">{t('search.match')}: {confidencePct}%</span>

          {source === 'ai' && (
            <span className="rounded-full bg-purple-900/50 px-2 py-0.5 text-xs text-purple-200">
              AI
            </span>
          )}

          {likes > 0 && (
            <span className="text-xs text-parchment-faint">❤️ {likes}</span>
          )}
        </div>

        {/* Actions — revealed when the card is expanded */}
        {expanded && (
          <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-ink-600 pt-3 animate-fade-in">
            {book && (
              <button
                onClick={() => onPreview(book)}
                className="btn-ghost px-4 py-2 text-sm border border-ink-600 hover:border-amber/50"
              >
                {t('search.preview')}
              </button>
            )}

            {book?.id && (
              <button
                onClick={handleLike}
                className={`flex items-center gap-1 rounded-lg px-3 py-2 text-sm transition-colors ${
                  isLiked ? 'bg-red-900/30 text-red-400' : 'bg-ink-700 text-parchment-dim hover:text-parchment'
                }`}
              >
                <span>{isLiked ? '❤️' : '🤍'}</span>
                {likes > 0 && <span>{likes}</span>}
              </button>
            )}

            <SaveButton
              quoteId={quoteId}
              quoteData={source === 'ai' ? { text, book, confidence } : undefined}
              className="px-4 py-2 text-sm"
            />

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
            {book?.id && (
              <a
                href={affiliateUrl(book.id, quoteId) || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary px-4 py-2 text-sm"
              >
                {t('search.buy')}
              </a>
            )}
          </div>
        )}
      </div>
    </article>

    {showGenerator && (
      <QuoteCardGenerator
        text={text}
        author={author}
        bookTitle={title}
        bookId={book?.id}
        onClose={() => setShowGenerator(false)}
      />
    )}
    </>
  );
}

function BookGridResult({ result, query, onPreview }) {
  const t = useI18n((s) => s.t);
  const { book, text, quoteId, confidence, source } = result;
  const title = book?.title || '';
  const author = book?.author || '';
  const cover = book?.coverImage;
  const [imgError, setImgError] = useState(false);
  const normalizedConfidence = normalizeConfidence(confidence, 0.75);
  const confidencePct = confidencePercent(confidence, 0.75);

  return (
    <div className="card animate-fade-in flex flex-col group cursor-pointer hover:border-amber/30 transition-all duration-200"
         onClick={() => onPreview(book)}>
      {/* Cover */}
      <div className="relative mb-3 aspect-[2/3] w-full overflow-hidden rounded-lg">
        {cover && !imgError ? (
          <img
            src={cover}
            alt={title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-ink-700 to-ink-800 text-parchment-faint">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M4 5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v16l-6-3-6 3z" />
            </svg>
          </div>
        )}
        {source === 'ai' && (
          <span className="absolute top-2 right-2 rounded-full bg-purple-900/70 px-2 py-0.5 text-xs text-purple-200">
            AI
          </span>
        )}
      </div>
      {/* Title / Author */}
      <p className="text-sm text-parchment line-clamp-1 font-medium">{title}</p>
      <p className="text-xs text-parchment-faint line-clamp-1">{author}</p>
      <div className="flex items-center gap-1 mt-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <svg key={i} width="10" height="10" viewBox="0 0 24 24"
            fill={i <= Math.round(normalizedConfidence * 5) ? 'currentColor' : 'none'}
            stroke="currentColor" strokeWidth="1.5" className="text-amber">
            <path d="M12 2l2.9 6.3L22 9.2l-5 4.9 1.2 6.9L12 17.8 5.8 21l1.2-6.9-5-4.9 7.1-.9z" />
          </svg>
        ))}
        <span className="ml-1 text-[10px] text-parchment-faint">{confidencePct}%</span>
      </div>
    </div>
  );
}

export default function SearchResults() {
  const t = useI18n((s) => s.t);
  const [params, setParams] = useSearchParams();
  const q = params.get('q') || '';
  const { results, loading, error, search } = useSearch();
  const [preview, setPreview] = useState(null);
  const [viewMode, setViewMode] = useState('list');
  const [expandedId, setExpandedId] = useState(null);
  const PAGE_SIZE = 10;
  const [shown, setShown] = useState(PAGE_SIZE);

  useEffect(() => {
    if (q.trim()) search(q);
  }, [q, search]);

  useEffect(() => { setShown(PAGE_SIZE); }, [results]);

  // Auto-open the top match so the first result is fully visible right away.
  useEffect(() => {
    setExpandedId(results.length > 0 ? results[0].quoteId : null);
  }, [results]);

  // Accordion: opening one card closes whichever was open before.
  function toggleExpand(id) {
    setExpandedId((current) => (current === id ? null : id));
  }

  function handleSearch(next) {
    setParams({ q: next });
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <SEO title={q ? `"${q.slice(0, 50)}" qidiruv natijalari` : 'Qidiruv'} />
      <div className="mb-8">
        <SearchBar initialValue={q} loading={loading} onSearch={handleSearch} />
      </div>

      {q && !loading && !error && (
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <h1 className="min-w-0 break-words text-base text-parchment-dim sm:text-lg">
            {t('search.results.for', { q })} — <span className="text-amber">{results.length}</span>
          </h1>
          <div className="flex items-center gap-1 bg-ink-700 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('list')}
              className={`rounded px-2.5 py-1.5 text-xs transition-colors ${viewMode === 'list' ? 'bg-ink-600 text-parchment' : 'text-parchment-faint hover:text-parchment'}`}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
              </svg>
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`rounded px-2.5 py-1.5 text-xs transition-colors ${viewMode === 'grid' ? 'bg-ink-600 text-parchment' : 'text-parchment-faint hover:text-parchment'}`}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {loading && (
        <div className={viewMode === 'list' ? 'space-y-4' : 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5'}>
          {viewMode === 'list'
            ? [...Array(5)].map((_, i) => <ResultSkeleton key={i} />)
            : [...Array(10)].map((_, i) => (
                <div key={i} className="card p-0">
                  <div className="skeleton aspect-[2/3] w-full rounded-lg" />
                </div>
              ))
          }
        </div>
      )}

      {error && !loading && (
        <div className="card text-center text-parchment-dim py-12">
          <p className="mb-3">{error}</p>
          <button onClick={() => search(q)} className="btn-ghost">
            {t('common.retry')}
          </button>
        </div>
      )}

      {!loading && !error && results.length === 0 && (
        <div className="py-16 text-center">
          <div className="text-6xl mb-4 text-parchment-faint">📚</div>
          <p className="text-lg text-parchment-dim">{t('search.empty')}</p>
        </div>
      )}

      {!loading && !error && results.length > 0 && viewMode === 'list' && (
        <div className="space-y-4">
          {results.slice(0, shown).map((r) => (
            <BookResultCard
              key={r.quoteId}
              result={r}
              query={q}
              expanded={expandedId === r.quoteId}
              onToggle={() => toggleExpand(r.quoteId)}
              onPreview={(book) => setPreview({ book, highlightText: r.text, quoteId: r.quoteId })}
            />
          ))}
        </div>
      )}

      {!loading && !error && results.length > 0 && viewMode === 'grid' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
          {results.slice(0, shown).map((r) => (
            <BookGridResult
              key={r.quoteId}
              result={r}
              query={q}
              onPreview={(book) => setPreview({ book, highlightText: r.text, quoteId: r.quoteId })}
            />
          ))}
        </div>
      )}

      {!loading && !error && results.length > shown && (
        <div className="mt-8 text-center">
          <button
            onClick={() => setShown((s) => s + PAGE_SIZE)}
            className="btn-ghost px-8 py-3"
          >
            {t('search.loadMore', { n: Math.min(PAGE_SIZE, results.length - shown) })}
          </button>
          <p className="mt-2 text-xs text-parchment-faint">{t('search.showing', { shown: Math.min(shown, results.length), total: results.length })}</p>
        </div>
      )}

      {preview && (
        <BookPreviewModal
          book={preview.book}
          highlightText={preview.highlightText}
          quoteId={preview.quoteId}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  );
}
