import { useEffect, useRef, useState } from 'react';
import api from '../services/api';
import { useI18n } from '../i18n';
import RichText from './RichText';
import BookPreviewModal from './BookPreviewModal';

function BookCard({ book, t, onOpen }) {
  const [imgErr, setImgErr] = useState(false);
  return (
    <div className="mt-2 flex items-center gap-3 rounded-xl border border-amber/30 bg-ink-700/60 p-3">
      {book.coverImage && !imgErr ? (
        <img
          src={book.coverImage}
          alt={book.title}
          className="h-16 w-11 flex-shrink-0 rounded-md object-cover shadow"
          onError={() => setImgErr(true)}
        />
      ) : (
        <div className="flex h-16 w-11 flex-shrink-0 items-center justify-center rounded-md bg-ink-600">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-parchment-faint">
            <path d="M4 5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v16l-6-3-6 3z" />
          </svg>
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="line-clamp-1 text-sm font-medium text-parchment">{book.title}</p>
        <p className="line-clamp-1 text-xs text-parchment-faint">{book.author}</p>
        {book.page && (
          <p className="mt-0.5 text-xs text-amber">{t('search.page', { n: book.page })}</p>
        )}
        {book.reason && (
          <p className="mt-0.5 line-clamp-2 text-xs text-parchment-dim">{book.reason}</p>
        )}
        <button
          onClick={() => onOpen(book)}
          className="mt-1.5 text-xs font-medium text-amber hover:underline"
        >
          {t('search.preview')} →
        </button>
      </div>
    </div>
  );
}

export default function AiChat() {
  const t = useI18n((s) => s.t);
  const lang = useI18n((s) => s.lang);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const scrollRef = useRef(null);

  const greeting = { role: 'assistant', content: t('ai.greeting'), books: [] };
  const view = messages.length === 0 ? [greeting] : messages;

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, open, loading]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;

    const history = messages.length === 0 ? [greeting] : messages;
    const next = [...history, { role: 'user', content: text }];
    setMessages(next);
    setInput('');
    setLoading(true);

    try {
      const { data } = await api.post('/ai/find-book', { question: text, messages: next, lang });
      setMessages([
        ...next,
        { role: 'assistant', content: data.reply || t('ai.error'), books: data.books || [] }
      ]);
    } catch {
      setMessages([...next, { role: 'assistant', content: t('ai.error'), books: [] }]);
    } finally {
      setLoading(false);
    }
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <>
      {/* Launcher */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={t('ai.open')}
        className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-amber text-ink shadow-xl transition-transform hover:scale-105"
      >
        {open ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v16l-6-3-6 3z" />
          </svg>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed bottom-24 right-5 z-50 flex h-[32rem] w-[24rem] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-2xl border border-ink-600 bg-ink-800 shadow-2xl animate-fade-in">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-ink-600 bg-ink-700 px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber/20 text-amber">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v16l-6-3-6 3z" />
                </svg>
              </div>
              <div>
                <p className="font-display text-base text-parchment">{t('ai.title')}</p>
                <p className="text-xs text-parchment-faint">{t('ai.subtitle')}</p>
              </div>
            </div>
            {messages.length > 0 && (
              <button
                onClick={() => setMessages([])}
                className="text-xs text-parchment-faint hover:text-parchment transition-colors"
              >
                ✕ Yangi
              </button>
            )}
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {view.map((m, i) => (
              <div key={i}>
                <div
                  className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm ${
                    m.role === 'user'
                      ? 'ml-auto rounded-br-md bg-amber text-ink'
                      : 'mr-auto rounded-bl-md bg-ink-700 text-parchment'
                  }`}
                >
                  <RichText text={m.content} />
                </div>
                {m.books && m.books.length > 0 && (
                  <div className="space-y-2">
                    {m.books.map((book, bi) => (
                      <BookCard
                        key={bi}
                        book={book}
                        t={t}
                        onOpen={(b) =>
                          setPreview({
                            book: { id: b.id, title: b.title, author: b.author, coverImage: b.coverImage, affiliateLink: b.affiliateLink },
                            highlightText: null
                          })
                        }
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="mr-auto flex gap-1 rounded-2xl bg-ink-700 px-4 py-3">
                <span className="h-2 w-2 animate-bounce rounded-full bg-parchment-faint [animation-delay:-0.3s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-parchment-faint [animation-delay:-0.15s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-parchment-faint" />
              </div>
            )}
          </div>

          {/* Input */}
          <div className="border-t border-ink-600 p-3">
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                rows={1}
                placeholder={t('ai.placeholder')}
                className="input max-h-24 flex-1 resize-none py-2 text-sm"
              />
              <button
                onClick={send}
                disabled={loading || !input.trim()}
                className="btn-primary px-3 py-2"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 2L11 13M22 2l-7 20-4-9-9-4z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {preview && (
        <BookPreviewModal
          book={preview.book}
          highlightText={preview.highlightText}
          onClose={() => setPreview(null)}
        />
      )}
    </>
  );
}
