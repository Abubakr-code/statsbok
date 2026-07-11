import { useEffect, useRef, useState } from 'react';
import api from '../services/api';
import { useI18n } from '../i18n';
import RichText from './RichText';

const LOGO = '/logo.jpg';

// Solid dark colors — no CSS variables, guaranteed opaque everywhere
const BG_DARK   = '#121008';  // main panel & messages
const BG_MID    = '#211E19';  // header & input area
const BG_BUBBLE = '#2A261F';  // assistant bubble
const CLR_TEXT  = '#F5F0E8';  // light text
const CLR_AMBER = '#E8A94A';  // amber / user bubble
const CLR_INK   = '#1A1814';  // dark text on amber

function BotAvatar() {
  const [err, setErr] = useState(false);
  return err ? (
    <div style={{ width: 32, height: 32, borderRadius: '50%', background: CLR_AMBER, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
      📚
    </div>
  ) : (
    <img
      src={LOGO}
      alt="AI"
      onError={() => setErr(true)}
      style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', border: `1.5px solid ${CLR_AMBER}44`, flexShrink: 0 }}
    />
  );
}

function TypingDots() {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, padding: '0 4px' }}>
      <BotAvatar />
      <div style={{ display: 'flex', gap: 4, background: BG_BUBBLE, borderRadius: '16px 16px 16px 4px', padding: '10px 14px' }}>
        {['-0.3s', '-0.15s', '0s'].map((d, i) => (
          <span key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: `${CLR_AMBER}B3`, display: 'inline-block', animation: `bounce 1s infinite ${d}` }} />
        ))}
      </div>
    </div>
  );
}

export default function AiChat() {
  const t    = useI18n((s) => s.t);
  const lang = useI18n((s) => s.lang);

  const [open,     setOpen]     = useState(false);
  const [messages, setMessages] = useState([]);
  const [input,    setInput]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const [unread,   setUnread]   = useState(0);
  const [logoErr,  setLogoErr]  = useState(false);

  const scrollRef  = useRef(null);
  const inputRef   = useRef(null);
  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  const greeting = { role: 'assistant', content: t('ai.greeting') };
  const view     = messages.length === 0 ? [greeting] : messages;

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, open, loading]);

  useEffect(() => {
    if (open) { setUnread(0); setTimeout(() => inputRef.current?.focus(), 100); }
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
      setMessages([...next, { role: 'assistant', content: data.reply || t('ai.error') }]);
      if (!open) setUnread((n) => n + 1);
    } catch (err) {
      if (!mountedRef.current) return;
      const status = err?.response?.status;
      const serverMsg = err?.response?.data?.message || '';
      let msg;
      if (status === 503 || /OPENROUTER|unavailable/i.test(serverMsg)) {
        msg = t('ai.disabled');
      } else if (status === 429) {
        msg = lang === 'uz' ? 'Juda ko\'p so\'rov. 1 daqiqa kutib qayta urinib ko\'ring.'
            : lang === 'ru' ? 'Слишком много запросов. Подождите минуту.'
            : 'Too many requests. Wait a minute and retry.';
      } else {
        msg = t('ai.error');
      }
      setMessages([...next, { role: 'assistant', content: msg }]);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendText(input); }
  }

  function clearChat() { setMessages([]); setInput(''); setTimeout(() => inputRef.current?.focus(), 50); }

  return (
    <>
      <style>{`
        @keyframes bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-5px)} }
        .aichat-panel { animation: aiFadeIn 0.25s ease-out; }
        @keyframes aiFadeIn { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        .aichat-scroll::-webkit-scrollbar { width: 4px; }
        .aichat-scroll::-webkit-scrollbar-track { background: transparent; }
        .aichat-scroll::-webkit-scrollbar-thumb { background: #3A3630; border-radius: 2px; }
      `}</style>

      {/* Launcher button */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={t('ai.open')}
        style={{
          position: 'fixed', bottom: 20, right: 20, zIndex: 9999,
          width: 56, height: 56, borderRadius: '50%',
          border: `2px solid ${CLR_AMBER}`,
          boxShadow: `0 0 20px ${CLR_AMBER}55`,
          overflow: 'hidden', cursor: 'pointer',
          background: BG_DARK,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'transform 0.2s, box-shadow 0.2s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.1)'; e.currentTarget.style.boxShadow = `0 0 28px ${CLR_AMBER}88`; }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = `0 0 20px ${CLR_AMBER}55`; }}
      >
        {open ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={CLR_INK} strokeWidth="2.5" style={{ background: CLR_AMBER, borderRadius: '50%', padding: 2, width: '100%', height: '100%' }}>
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        ) : logoErr ? (
          <span style={{ fontSize: 26 }}>📚</span>
        ) : (
          <img src={LOGO} alt="AI" onError={() => setLogoErr(true)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        )}
        {!open && unread > 0 && (
          <span style={{
            position: 'absolute', top: -4, right: -4,
            width: 20, height: 20, borderRadius: '50%',
            background: '#EF4444', color: '#fff',
            fontSize: 10, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: `2px solid ${BG_DARK}`,
          }}>
            {unread}
          </span>
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div
          className="aichat-panel"
          style={{
            position: 'fixed', bottom: 86, right: 20, zIndex: 9998,
            width: 'min(368px, calc(100vw - 24px))',
            height: '30rem',
            display: 'flex', flexDirection: 'column',
            borderRadius: 18,
            border: `1px solid ${CLR_AMBER}33`,
            background: BG_DARK,
            boxShadow: '0 20px 60px rgba(0,0,0,0.7)',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            background: BG_MID,
            borderBottom: `1px solid ${CLR_AMBER}22`,
            padding: '12px 16px',
            flexShrink: 0,
          }}>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              {logoErr ? (
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: CLR_AMBER, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>📚</div>
              ) : (
                <img src={LOGO} alt="AI" onError={() => setLogoErr(true)} style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', border: `1.5px solid ${CLR_AMBER}44` }} />
              )}
              <span style={{ position: 'absolute', bottom: -2, right: -2, width: 12, height: 12, borderRadius: '50%', background: '#22C55E', border: `2px solid ${BG_MID}` }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ color: CLR_TEXT, fontSize: 14, fontWeight: 600, margin: 0 }}>{t('ai.title')}</p>
              <p style={{ color: '#22C55E', fontSize: 11, margin: 0 }}>● {t('ai.subtitle')}</p>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {messages.length > 0 && (
                <button onClick={clearChat} title="Tozalash" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8A8270', padding: 6, borderRadius: 8, display: 'flex' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#3A3630'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'none'}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /></svg>
                </button>
              )}
              <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8A8270', padding: 6, borderRadius: 8, display: 'flex' }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#3A3630'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'none'}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 6l12 12M18 6L6 18" /></svg>
              </button>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="aichat-scroll" style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 12, background: BG_DARK }}>
            {view.map((m, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-end', gap: 8, justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                {m.role === 'assistant' && <BotAvatar />}
                <div style={{
                  maxWidth: '78%',
                  borderRadius: m.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                  padding: '10px 14px',
                  fontSize: 13,
                  lineHeight: 1.6,
                  background: m.role === 'user' ? CLR_AMBER : BG_BUBBLE,
                  color: m.role === 'user' ? CLR_INK : CLR_TEXT,
                  border: m.role === 'assistant' ? `1px solid #39342B` : 'none',
                  fontWeight: m.role === 'user' ? 500 : 400,
                }}>
                  <RichText text={m.content} />
                </div>
                {m.role === 'user' && (
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#3A3630', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
                    👤
                  </div>
                )}
              </div>
            ))}
            {loading && <TypingDots />}
          </div>

          {/* Input */}
          <div style={{ background: BG_MID, borderTop: `1px solid #39342B`, padding: '12px' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                rows={1}
                placeholder={t('ai.placeholder')}
                style={{
                  flex: 1,
                  background: BG_DARK,
                  color: CLR_TEXT,
                  border: `1px solid #39342B`,
                  borderRadius: 12,
                  padding: '8px 12px',
                  fontSize: 13,
                  resize: 'none',
                  outline: 'none',
                  maxHeight: 80,
                  fontFamily: 'inherit',
                  lineHeight: 1.5,
                }}
                onFocus={(e) => e.target.style.borderColor = `${CLR_AMBER}80`}
                onBlur={(e) => e.target.style.borderColor = '#39342B'}
              />
              <button
                onClick={() => sendText(input)}
                disabled={loading || !input.trim()}
                style={{
                  width: 36, height: 36,
                  borderRadius: 10,
                  background: CLR_AMBER,
                  border: 'none',
                  cursor: input.trim() && !loading ? 'pointer' : 'not-allowed',
                  opacity: input.trim() && !loading ? 1 : 0.4,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                  transition: 'opacity 0.2s',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={CLR_INK} strokeWidth="2.5">
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
