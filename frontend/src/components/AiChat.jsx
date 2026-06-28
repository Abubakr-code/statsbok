import { useEffect, useRef, useState } from 'react';
import api from '../services/api';
import { useI18n } from '../i18n';
import RichText from './RichText';

/**
 * Floating book-assistant chat. Available on every page (bottom-right).
 * Talks to POST /api/ai/chat which is backed by a free OpenRouter model.
 */
export default function AiChat() {
  const t = useI18n((s) => s.t);
  const lang = useI18n((s) => s.lang);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);
  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  const greeting = { role: 'assistant', content: t('ai.greeting') };
  const view = messages.length === 0 ? [greeting] : messages;

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, open, loading]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    const next = [...messages.length ? messages : [greeting], { role: 'user', content: text }];
    setMessages(next);
    setInput('');
    setLoading(true);
    try {
      const { data } = await api.post('/ai/chat', { messages: next, lang });
      if (mountedRef.current) setMessages([...next, { role: 'assistant', content: data.reply || t('ai.error') }]);
    } catch (err) {
      const msg = err.status === 500 && /OPENROUTER/i.test(err.message) ? t('ai.disabled') : t('ai.error');
      if (mountedRef.current) setMessages([...next, { role: 'assistant', content: msg }]);
    } finally {
      if (mountedRef.current) setLoading(false);
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
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed bottom-24 right-5 z-50 flex h-[28rem] w-[22rem] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-2xl border border-ink-600 bg-ink-800 shadow-2xl animate-fade-in">
          <div className="flex items-center gap-3 border-b border-ink-600 bg-ink-700 px-4 py-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber/20 text-amber">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2l2.4 5.2L20 8l-4 4 1 6-5-2.8L7 18l1-6-4-4 5.6-.8z" />
              </svg>
            </div>
            <div>
              <p className="font-display text-base text-parchment">{t('ai.title')}</p>
              <p className="text-xs text-parchment-faint">{t('ai.subtitle')}</p>
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {view.map((m, i) => (
              <div
                key={i}
                className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm ${
                  m.role === 'user'
                    ? 'ml-auto rounded-br-md bg-amber text-ink'
                    : 'mr-auto rounded-bl-md bg-ink-700 text-parchment'
                }`}
              >
                <RichText text={m.content} />
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
              <button onClick={send} disabled={loading || !input.trim()} className="btn-primary px-3 py-2">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 2L11 13M22 2l-7 20-4-9-9-4z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
