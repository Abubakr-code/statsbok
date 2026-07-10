import { useState, useRef } from 'react';
import api from '../services/api';
import { useI18n } from '../i18n';
import BookPreviewModal from './BookPreviewModal';

function AiBookCard({ book, onOpen }) {
  const t = useI18n((s) => s.t);
  const [imgErr, setImgErr] = useState(false);

  return (
    <div
      className="group flex cursor-pointer items-start gap-3 rounded-xl border border-amber/15 bg-ink-900/70 p-3 transition-all duration-200 hover:border-amber/40 hover:bg-ink-800/80"
      onClick={() =>
        onOpen({
          id: book.id,
          title: book.title,
          author: book.author,
          coverImage: book.coverImage,
          affiliateLink: book.affiliateLink
        })
      }
    >
      {book.coverImage && !imgErr ? (
        <img
          src={book.coverImage}
          alt={book.title}
          className="h-20 w-14 shrink-0 rounded-lg object-cover shadow-md transition-shadow group-hover:shadow-amber/20"
          onError={() => setImgErr(true)}
        />
      ) : (
        <div className="flex h-20 w-14 shrink-0 items-center justify-center rounded-lg border border-ink-600 bg-ink-700">
          <span className="text-2xl" aria-hidden>📖</span>
        </div>
      )}

      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-sm font-medium leading-snug text-parchment transition-colors group-hover:text-amber">
          {book.title}
        </p>
        <p className="mt-0.5 text-xs text-parchment-faint">✍️ {book.author}</p>

        {book.page && (
          <span className="mt-1.5 inline-block rounded-full bg-amber/15 px-2 py-0.5 text-xs font-medium text-amber">
            📄 {t('search.page', { n: book.page })}
          </span>
        )}

        {book.reason && (
          <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-parchment-dim">
            {book.reason}
          </p>
        )}

        <p className="mt-2 text-xs font-medium text-amber/70 transition-colors group-hover:text-amber">
          {t('search.preview')} →
        </p>
      </div>
    </div>
  );
}

export default function AiBookOracle() {
  const t = useI18n((s) => s.t);
  const lang = useI18n((s) => s.lang);

  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [preview, setPreview] = useState(null);
  const inputRef = useRef(null);

  async function fetchBooks(q) {
    if (!q || !q.trim() || loading) return;
    setLoading(true);
    setResults(null);
    try {
      const { data } = await api.post('/ai/find-book', { question: q.trim(), lang });
      // 503 comes with { reply, books:[] } when AI is temporarily down
      setResults(data);
    } catch (err) {
      const serverReply = err?.response?.data?.reply;
      const reply = serverReply || t('ai.error');
      setResults({ reply, books: [] });
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e) {
    e?.preventDefault();
    fetchBooks(question);
  }

  function handleKey(e) {
    if (e.key === 'Enter') fetchBooks(question);
  }

  function reset() {
    setResults(null);
    setQuestion('');
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  const chips = t('ai.oracle.chips').split('|').filter(Boolean);

  return (
    <div className="mx-auto mt-10 w-full max-w-2xl text-left">
      <div className="relative overflow-hidden rounded-2xl border border-amber/20 bg-gradient-to-br from-amber/8 via-ink-800/80 to-ink-900 p-5 shadow-lg">
        {/* Ambient glow */}
        <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-amber/10 blur-2xl" />

        {/* Header */}
        <div className="relative flex items-start gap-3">
          <span className="select-none text-2xl" aria-hidden>🔮</span>
          <div>
            <h3 className="font-display text-base text-parchment">{t('ai.oracle.heading')}</h3>
            <p className="mt-0.5 text-sm leading-relaxed text-parchment-dim">{t('ai.oracle.desc')}</p>
          </div>
        </div>

        {/* Quick-pick chips — hidden while loading or showing results */}
        {!results && !loading && chips.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {chips.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => { setQuestion(chip); fetchBooks(chip); }}
                className="rounded-full border border-amber/25 bg-amber/8 px-3 py-1 text-xs text-amber transition-colors hover:bg-amber/15"
              >
                {chip}
              </button>
            ))}
          </div>
        )}

        {/* Input row */}
        <form onSubmit={handleSubmit} className="relative mt-4 flex gap-2">
          <input
            ref={inputRef}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={handleKey}
            placeholder={t('ai.oracle.placeholder')}
            className="input flex-1 border-ink-500 bg-ink-900/60 text-sm focus:border-amber/50"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !question.trim()}
            className="btn-primary flex shrink-0 items-center gap-1.5 px-4 py-2 text-sm disabled:opacity-40"
          >
            {loading ? (
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink [animation-delay:-0.3s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink [animation-delay:-0.15s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink" />
              </span>
            ) : (
              <>{t('ai.oracle.btn')} ✨</>
            )}
          </button>
        </form>

        {/* Results */}
        {results && (
          <div className="mt-5">
            {results.reply && (
              <div className="mb-4 flex gap-2">
                <span className="shrink-0 select-none text-lg" aria-hidden>🤖</span>
                <p className="text-sm leading-relaxed text-parchment-dim">{results.reply}</p>
              </div>
            )}

            {results.books && results.books.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {results.books.slice(0, 4).map((book, i) => (
                  <AiBookCard key={i} book={book} onOpen={setPreview} />
                ))}
              </div>
            ) : (
              <p className="py-4 text-center text-sm text-parchment-faint">
                📭 {t('ai.oracle.noResult')}
              </p>
            )}

            <button
              type="button"
              onClick={reset}
              className="mt-4 text-xs text-parchment-faint transition-colors hover:text-amber"
            >
              ← {t('ai.oracle.back')}
            </button>
          </div>
        )}
      </div>

      {preview && (
        <BookPreviewModal
          book={preview}
          highlightText={null}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  );
}
