import { useEffect, useRef, useState } from 'react';
import api from '../services/api';
import { useI18n } from '../i18n';
import RichText from './RichText';

const SUGGESTIONS = {
  uz: [
    "📖 O'qishni qayerdan boshlasam?",
    "🌹 Navoiy haqida ayting",
    "💡 Eng yaxshi tarix kitoblari",
    "🎯 Motivatsion kitob tavsiya",
  ],
  en: [
    "📖 Where should I start reading?",
    "💡 Best history books",
    "🎯 Recommend a motivational book",
    "✨ Classic novels to read",
  ],
  ru: [
    "📖 С чего начать читать?",
    "💡 Лучшие книги по истории",
    "🎯 Посоветуй мотивирующую книгу",
    "✨ Классика, которую стоит прочесть",
  ],
};

const LOGO = '/logo.jpg';

function BotAvatar({ size = 8 }) {
  return (
    <img
      src={LOGO}
      alt="StatBooks AI"
      className={`h-${size} w-${size} shrink-0 rounded-full object-cover border border-amber/30`}
    />
  );
}

function TypingDots() {
  return (
    <div className="mr-auto flex items-end gap-2 px-1">
      <BotAvatar />
      <div className="flex items-center gap-1 rounded-2xl rounded-bl-sm bg-ink-700 px-4 py-3">
        <span className="h-2 w-2 animate-bounce rounded-full bg-amber/70 [animation-delay:-0.3s]" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-amber/70 [animation-delay:-0.15s]" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-amber/70" />
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
  const [unread, setUnread] = useState(0);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  const greeting = { role: 'assistant', content: t('ai.greeting') };
  const view = messages.length === 0 ? [greeting] : messages;
  const suggestions = SUGGESTIONS[lang] || SUGGESTIONS.uz;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open, loading]);

  useEffect(() => {
    if (open) {
      setUnread(0);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  async function sendText(text) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    const history = messages.length ? messages : [greeting];
    const next = [...history, { role: 'user', content: trimmed }];
    setMessages(next);
    setInput('');
    setLoading(true);
    try {
      const { data } = await api.post('/ai/chat', { messages: next, lang });
      if (!mountedRef.current) return;
      const reply = data.reply || t('ai.error');
      setMessages([...next, { role: 'assistant', content: reply }]);
      if (!open) setUnread((n) => n + 1);
    } catch (err) {
      if (!mountedRef.current) return;
      const status = err?.response?.status;
      const serverMsg = err?.response?.data?.message || '';
      let msg;
      if (status === 503 || /OPENROUTER|unavailable/i.test(serverMsg)) {
        msg = t('ai.disabled');
      } else if (status === 429) {
        msg = lang === 'uz' ? 'Juda ko\'p so\'rov yuborildi. 1 daqiqa kutib qayta urinib ko\'ring.' :
              lang === 'ru' ? 'Слишком много запросов. Подождите минуту и попробуйте снова.' :
              'Too many requests. Please wait a minute and try again.';
      } else {
        msg = t('ai.error');
      }
      setMessages([...next, { role: 'assistant', content: msg }]);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }

  function send() { sendText(input); }

  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  function clearChat() {
    setMessages([]);
    setInput('');
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  return (
    <>
      {/* Launcher button */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={t('ai.open')}
        className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border-2 border-amber shadow-xl shadow-amber/30 transition-all duration-200 hover:scale-110 hover:shadow-amber/50 active:scale-95"
      >
        {open ? (
          <div className="flex h-full w-full items-center justify-center bg-amber">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1a1814" strokeWidth="2.5">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </div>
        ) : (
          <img src={LOGO} alt="StatBooks AI" className="h-full w-full object-cover" />
        )}
        {!open && unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            {unread}
          </span>
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div style={{ background: 'rgb(18 16 12)' }} className="fixed bottom-24 right-5 z-50 flex h-[32rem] w-[23rem] max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-2xl border border-amber/20 shadow-2xl shadow-black/60 animate-fade-in opacity-100">

          {/* Header */}
          <div style={{ background: 'rgb(33 30 25)' }} className="flex items-center gap-3 border-b border-ink-700 px-4 py-3">
            <div className="relative shrink-0">
              <img src={LOGO} alt="StatBooks AI" className="h-10 w-10 rounded-full object-cover border border-amber/30" />
              <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-ink-900 bg-green-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-display text-sm text-parchment">{t('ai.title')}</p>
              <p className="text-xs text-green-400">● {t('ai.subtitle')}</p>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button
                  onClick={clearChat}
                  title="Tozalash"
                  className="rounded-lg p-1.5 text-parchment-faint hover:bg-ink-700 hover:text-parchment transition-colors"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
                  </svg>
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg p-1.5 text-parchment-faint hover:bg-ink-700 hover:text-parchment transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} style={{ background: 'rgb(18 16 12)' }} className="flex-1 space-y-3 overflow-y-auto px-4 py-4 scroll-smooth">
            {view.map((m, i) => (
              <div key={i} className={`flex items-end gap-2 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {m.role === 'assistant' && <BotAvatar />}
                <div
                  style={m.role === 'user'
                    ? { background: 'rgb(232 169 74)', color: 'rgb(26 24 20)' }
                    : { background: 'rgb(42 38 31)', color: 'rgb(245 240 232)', border: '1px solid rgb(57 52 43)' }
                  }
                  className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm ${
                    m.role === 'user' ? 'rounded-br-sm font-medium' : 'rounded-bl-sm'
                  }`}
                >
                  <RichText text={m.content} />
                </div>
                {m.role === 'user' && (
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink-700 text-base select-none">
                    👤
                  </span>
                )}
              </div>
            ))}

            {loading && <TypingDots />}

            {/* Suggestion chips — only before first user message */}
            {messages.length === 0 && !loading && (
              <div className="mt-3 flex flex-wrap gap-2">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => sendText(s)}
                    className="rounded-full border border-amber/25 bg-amber/8 px-3 py-1 text-xs text-amber transition-colors hover:bg-amber/20"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Input */}
          <div style={{ background: 'rgb(18 16 12)' }} className="border-t border-ink-700 p-3">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                rows={1}
                placeholder={t('ai.placeholder')}
                style={{ background: 'rgb(33 30 25)', color: 'rgb(245 240 232)' }}
                className="input max-h-20 flex-1 resize-none py-2 text-sm border-ink-600 focus:border-amber/50"
              />
              <button
                onClick={send}
                disabled={loading || !input.trim()}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber text-ink transition-all hover:bg-amber/90 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M22 2L11 13M22 2l-7 20-4-9-9-4z" />
                </svg>
              </button>
            </div>
            <p className="mt-1.5 text-center text-[10px] text-parchment-faint">
              Enter — yuborish · Shift+Enter — yangi qator
            </p>
          </div>
        </div>
      )}
    </>
  );
}
