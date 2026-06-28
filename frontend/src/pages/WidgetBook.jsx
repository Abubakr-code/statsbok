import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

export default function WidgetBook() {
  const { bookId = '' } = useParams();
  const params = new URLSearchParams(window.location.search);
  const bloggerId = params.get('blogger') || '';
  const theme = params.get('theme') || 'dark';

  const [quotes, setQuotes] = useState([]);
  const [idx, setIdx]       = useState(0);
  const [loading, setLoading] = useState(true);

  const apiBase = (() => {
    const u = import.meta.env.VITE_API_URL || '/api';
    return u.startsWith('http') ? u : window.location.origin + '/api';
  })();

  useEffect(() => {
    if (!bookId) { setLoading(false); return; }
    fetch(`${apiBase}/public/widget/book/${bookId}`)
      .then((r) => r.json())
      .then((d) => setQuotes(d.quotes || []))
      .catch(() => {})
      .finally(() => setLoading(false));

    if (bloggerId) {
      fetch(`${apiBase}/blogger/widget/click`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bloggerId })
      }).catch(() => {});
    }
  }, [bookId]);

  const isDark = theme === 'dark';
  const bg    = isDark ? '#1A1814' : '#FAF6F0';
  const text  = isDark ? '#E8DCC8' : '#2C1810';
  const dim   = isDark ? '#9B8B6B' : '#7A6045';
  const amber = '#E8A94A';
  const cardBg = isDark ? '#242018' : '#FFFFFF';
  const btnBg  = isDark ? '#2E2820' : '#EDE8E0';

  if (loading) {
    return (
      <div style={{ background: bg, color: dim, fontFamily: 'Georgia,serif', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '260px' }}>
        Yuklanmoqda…
      </div>
    );
  }

  if (!quotes.length) {
    return (
      <div style={{ background: bg, color: dim, fontFamily: 'Georgia,serif', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '260px' }}>
        Statalar topilmadi.
      </div>
    );
  }

  const q = quotes[idx];
  const book = q?.bookId || {};

  return (
    <div style={{ background: bg, color: text, fontFamily: 'Georgia,serif', minHeight: '260px', padding: '20px 24px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Book info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {book.coverImage && (
          <img src={book.coverImage} alt="" style={{ width: '36px', height: '50px', objectFit: 'cover', borderRadius: '4px' }} />
        )}
        <div>
          <p style={{ margin: 0, fontSize: '13px', color: text, fontWeight: 'bold' }}>{book.titleUz || book.title || '—'}</p>
          {book.author && <p style={{ margin: 0, fontSize: '11px', color: dim }}>{book.author}</p>}
        </div>
      </div>

      {/* Quote */}
      <blockquote style={{ margin: 0, flex: 1, fontSize: '14px', lineHeight: '1.7', color: text, borderLeft: `3px solid ${amber}`, paddingLeft: '14px', fontStyle: 'italic' }}>
        "{q.text}"
      </blockquote>

      {/* Navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            onClick={() => setIdx((i) => Math.max(0, i - 1))}
            disabled={idx === 0}
            style={{ background: btnBg, border: 'none', color: idx === 0 ? dim : text, borderRadius: '6px', padding: '4px 10px', cursor: idx === 0 ? 'default' : 'pointer', fontSize: '14px' }}
          >
            ‹
          </button>
          <button
            onClick={() => setIdx((i) => Math.min(quotes.length - 1, i + 1))}
            disabled={idx === quotes.length - 1}
            style={{ background: btnBg, border: 'none', color: idx === quotes.length - 1 ? dim : text, borderRadius: '6px', padding: '4px 10px', cursor: idx === quotes.length - 1 ? 'default' : 'pointer', fontSize: '14px' }}
          >
            ›
          </button>
        </div>
        <p style={{ margin: 0, fontSize: '10px', color: dim }}>
          {idx + 1} / {quotes.length}
        </p>
        <a href={window.location.origin} target="_blank" rel="noopener noreferrer" style={{ fontSize: '10px', color: amber, textDecoration: 'none', opacity: 0.6 }}>
          StatBooks.uz
        </a>
      </div>
    </div>
  );
}
