import { useEffect, useState } from 'react';

export default function WidgetDaily() {
  const params = new URLSearchParams(window.location.search);
  const bloggerId = params.get('blogger') || '';
  const theme = params.get('theme') || 'dark';

  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(true);

  const apiBase = (() => {
    const u = import.meta.env.VITE_API_URL || '/api';
    return u.startsWith('http') ? u : window.location.origin + '/api';
  })();

  useEffect(() => {
    fetch(`${apiBase}/public/widget/daily`)
      .then((r) => r.json())
      .then((d) => setQuote(d.quote))
      .catch(() => {})
      .finally(() => setLoading(false));

    if (bloggerId) {
      fetch(`${apiBase}/blogger/widget/click`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bloggerId })
      }).catch(() => {});
    }
  }, []);

  const isDark = theme === 'dark';

  const bg    = isDark ? '#1A1814' : '#FAF6F0';
  const text  = isDark ? '#E8DCC8' : '#2C1810';
  const dim   = isDark ? '#9B8B6B' : '#7A6045';
  const amber = '#E8A94A';

  if (loading) {
    return (
      <div style={{ background: bg, color: dim, fontFamily: 'Georgia,serif', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '180px', padding: '20px' }}>
        Yuklanmoqda…
      </div>
    );
  }

  if (!quote) {
    return (
      <div style={{ background: bg, color: dim, fontFamily: 'Georgia,serif', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '180px', padding: '20px' }}>
        Bugun uchun stata topilmadi.
      </div>
    );
  }

  const book = quote.bookId || {};

  return (
    <div style={{ background: bg, color: text, fontFamily: 'Georgia,serif', minHeight: '180px', padding: '20px 24px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '10px' }}>
      <p style={{ fontSize: '13px', color: amber, letterSpacing: '0.05em', textTransform: 'uppercase', margin: 0 }}>
        ☀️ Kunlik stata
      </p>
      <blockquote style={{ margin: 0, fontSize: '15px', lineHeight: '1.7', color: text, borderLeft: `3px solid ${amber}`, paddingLeft: '14px', fontStyle: 'italic' }}>
        "{quote.text}"
      </blockquote>
      {(book.titleUz || book.title) && (
        <p style={{ margin: 0, fontSize: '12px', color: dim }}>
          — {book.author && `${book.author}, `}{book.titleUz || book.title}
        </p>
      )}
      <a
        href={window.location.origin}
        target="_blank"
        rel="noopener noreferrer"
        style={{ marginTop: '4px', fontSize: '10px', color: amber, textDecoration: 'none', alignSelf: 'flex-end', opacity: 0.6 }}
      >
        StatBooks.uz
      </a>
    </div>
  );
}
