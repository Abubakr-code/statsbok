import { useState, useRef } from 'react';

export default function WidgetSearch() {
  const params    = new URLSearchParams(window.location.search);
  const bloggerId = params.get('blogger') || '';
  const theme     = params.get('theme') || 'dark';

  const [query,   setQuery]   = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [clicked, setClicked]   = useState(false);
  const timerRef = useRef(null);

  const apiBase = (() => {
    const u = import.meta.env.VITE_API_URL || '/api';
    return u.startsWith('http') ? u : window.location.origin + '/api';
  })();

  const trackClick = () => {
    if (clicked || !bloggerId) return;
    setClicked(true);
    fetch(`${apiBase}/blogger/widget/click`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bloggerId })
    }).catch(() => {});
  };

  const search = async (q) => {
    if (!q || q.length < 2) { setResults([]); setSearched(false); return; }
    setLoading(true);
    trackClick();
    try {
      const r = await fetch(`${apiBase}/quotes/search?q=${encodeURIComponent(q)}&limit=5`);
      const d = await r.json();
      setResults(d.results || d.quotes || []);
      setSearched(true);
    } catch { setResults([]); }
    finally { setLoading(false); }
  };

  const handleInput = (e) => {
    const q = e.target.value;
    setQuery(q);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => search(q), 500);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') { clearTimeout(timerRef.current); search(query); }
  };

  const isDark = theme === 'dark';
  const bg     = isDark ? '#1A1814' : '#FAF6F0';
  const text   = isDark ? '#E8DCC8' : '#2C1810';
  const dim    = isDark ? '#9B8B6B' : '#7A6045';
  const amber  = '#E8A94A';
  const inputBg = isDark ? '#242018' : '#FFFFFF';
  const border  = isDark ? '#3A3020' : '#D4C8A8';
  const cardBg  = isDark ? '#222018' : '#FFFFFF';

  return (
    <div
      style={{
        background: bg, color: text, fontFamily: 'Georgia, serif',
        minHeight: '100%', padding: '16px', boxSizing: 'border-box',
        display: 'flex', flexDirection: 'column', gap: '12px'
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <p style={{ margin: 0, fontSize: '13px', color: amber, fontWeight: 'bold', letterSpacing: '0.05em' }}>
          📚 StatBooks
        </p>
        <p style={{ margin: 0, fontSize: '11px', color: dim }}>Kitob qidirish</p>
      </div>

      {/* Search input */}
      <input
        type="text"
        value={query}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        placeholder="Iqtibos yoki kitob nomini kiriting…"
        style={{
          background: inputBg, border: `1px solid ${border}`, borderRadius: '8px',
          color: text, fontSize: '13px', padding: '9px 12px', width: '100%',
          boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit'
        }}
      />

      {/* Results */}
      {loading && <p style={{ color: dim, fontSize: '12px', textAlign: 'center', margin: 0 }}>Qidirilmoqda…</p>}

      {!loading && searched && results.length === 0 && (
        <p style={{ color: dim, fontSize: '12px', textAlign: 'center', margin: 0 }}>
          Hech narsa topilmadi. Boshqacha yozib ko'ring.
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', maxHeight: '380px' }}>
        {results.map((item, i) => {
          const q = item.quote || item;
          const book = item.book || q.bookId || {};
          const conf = item.confidence ? Math.round(item.confidence * 100) : null;
          return (
            <div
              key={i}
              style={{
                background: cardBg, borderRadius: '8px', padding: '10px 12px',
                border: `1px solid ${border}`, display: 'flex', flexDirection: 'column', gap: '6px'
              }}
            >
              <p style={{ margin: 0, fontSize: '12px', lineHeight: '1.6', color: text, fontStyle: 'italic' }}>
                "{q.text}"
              </p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <p style={{ margin: 0, fontSize: '11px', color: dim }}>
                  {book.titleUz || book.title || ''}
                  {(book.titleUz || book.title) && book.author ? ' · ' : ''}
                  {book.author || ''}
                </p>
                {conf && (
                  <span style={{ fontSize: '10px', color: amber }}>{conf}%</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <a
        href={window.location.origin}
        target="_blank"
        rel="noopener noreferrer"
        style={{ marginTop: 'auto', fontSize: '10px', color: amber, textDecoration: 'none', alignSelf: 'center', opacity: 0.5 }}
      >
        statbooks.uz
      </a>
    </div>
  );
}
