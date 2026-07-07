import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import SEO from '../../components/SEO';

function StarRating({ rating }) {
  return (
    <div className="flex gap-0.5 text-lg">
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={i <= rating ? 'text-amber' : 'text-ink-600'}>★</span>
      ))}
    </div>
  );
}

function ShareButton({ title, url }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`;

  return (
    <div className="flex items-center gap-2">
      <a
        href={telegramUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 rounded-lg border border-ink-600 bg-ink-800 px-3 py-1.5 text-xs text-parchment-dim hover:border-amber/40 hover:text-amber transition-colors"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.26 13.947l-2.948-.924c-.642-.203-.654-.642.136-.953l11.507-4.436c.534-.194 1.002.131.939.587z" />
        </svg>
        Telegram
      </a>
      <button
        onClick={copy}
        className="flex items-center gap-1.5 rounded-lg border border-ink-600 bg-ink-800 px-3 py-1.5 text-xs text-parchment-dim hover:border-amber/40 hover:text-amber transition-colors"
      >
        {copied ? (
          <>✓ Nusxalandi</>
        ) : (
          <>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="9" y="9" width="13" height="13" rx="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
            Havola nusxalash
          </>
        )}
      </button>
    </div>
  );
}

export default function PublicReviewPage() {
  const { username, slug } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch(`/api/reviews/${username}/${slug}`)
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then(setData)
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [username, slug]);

  if (loading) {
    return (
      <div className="py-24 text-center">
        <div className="flex justify-center gap-1.5">
          <span className="h-2 w-2 animate-bounce rounded-full bg-amber [animation-delay:-0.3s]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-amber [animation-delay:-0.15s]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-amber" />
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="py-24 text-center">
        <p className="text-4xl mb-4">📕</p>
        <p className="text-parchment-dim mb-2">Taqriz topilmadi yoki yopiq.</p>
        <p className="text-parchment-faint text-sm mb-6">Sahifa o'chirilgan yoki muallifga maxsus.</p>
        <Link to="/" className="btn-primary px-5 py-2 text-sm">Bosh sahifaga qaytish</Link>
      </div>
    );
  }

  const currentUrl = typeof window !== 'undefined' ? window.location.href : '';
  const shareTitle = `${data.user.name} — "${data.book.title}" haqida taqriz`;
  const wordCount = data.review.text ? data.review.text.split(/\s+/).length : 0;
  const readMin = Math.max(1, Math.round(wordCount / 200));

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <SEO
        title={`${data.book.title} — ${data.user.name} taqrizi`}
        description={data.review.text?.slice(0, 160)}
      />

      {/* Breadcrumb */}
      <nav className="mb-8 flex items-center gap-2 text-xs text-parchment-faint">
        <Link to="/" className="hover:text-amber transition-colors">StatBooks</Link>
        <span>/</span>
        <span className="text-parchment-dim">Taqriz</span>
      </nav>

      {/* Book info */}
      <div className="mb-8 flex items-start gap-5">
        {data.book.coverUrl ? (
          <img
            src={data.book.coverUrl}
            alt={data.book.title}
            className="w-24 shrink-0 rounded-xl shadow-xl shadow-ink/50"
          />
        ) : (
          <div className="flex h-32 w-24 shrink-0 items-center justify-center rounded-xl bg-ink-700 border border-ink-600">
            <span className="text-3xl">📖</span>
          </div>
        )}
        <div className="min-w-0">
          <h1 className="font-display text-2xl leading-snug text-parchment sm:text-3xl">
            {data.book.title}
          </h1>
          <p className="mt-1 text-parchment-dim">{data.book.author}</p>
          {data.book.year && (
            <p className="mt-0.5 text-xs text-parchment-faint">{data.book.year}</p>
          )}
          {data.book.rating > 0 && (
            <div className="mt-2">
              <StarRating rating={data.book.rating} />
            </div>
          )}
          {data.book.shelf && (
            <span className="mt-2 inline-block rounded-full bg-amber/15 px-2.5 py-0.5 text-xs font-medium text-amber capitalize">
              {{
                finished: '✅ O\'qib bo\'lindi',
                reading: '📖 O\'qilmoqda',
                want: '📌 O\'qimoqchi',
              }[data.book.shelf] || data.book.shelf}
            </span>
          )}
        </div>
      </div>

      {/* Author info */}
      <div className="mb-6 flex items-center justify-between gap-3 rounded-xl border border-ink-600 bg-ink-800/60 px-4 py-3">
        <div className="flex items-center gap-3">
          {data.user.avatarUrl ? (
            <img src={data.user.avatarUrl} alt="" className="h-9 w-9 rounded-full object-cover" />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-ink-700 text-base">👤</div>
          )}
          <div>
            <p className="text-sm font-medium text-parchment">{data.user.name}</p>
            <p className="text-xs text-parchment-faint">
              {new Date(data.review.createdAt || Date.now()).toLocaleDateString('uz-UZ', {
                year: 'numeric', month: 'long', day: 'numeric'
              })}
              {' · '}~{readMin} daqiqa o'qish
            </p>
          </div>
        </div>
        <ShareButton title={shareTitle} url={currentUrl} />
      </div>

      {/* Review text */}
      <div className="relative rounded-2xl border border-ink-600 bg-ink-800/40 p-6 shadow-inner">
        <span className="absolute left-4 top-3 font-display text-5xl leading-none text-amber/20 select-none" aria-hidden>❝</span>
        <div className="relative mt-4">
          <p className="text-parchment leading-relaxed whitespace-pre-wrap text-[0.95rem]">
            {data.review.text}
          </p>
        </div>
        <span className="absolute bottom-3 right-5 font-display text-5xl leading-none text-amber/20 select-none" aria-hidden>❞</span>
      </div>

      {/* Footer CTA */}
      <div className="mt-10 rounded-xl border border-amber/20 bg-amber/5 p-6 text-center">
        <p className="text-parchment-dim text-sm mb-1">
          📚 Bu kitobning iqtiboslarini qidiring
        </p>
        <h3 className="font-display text-lg text-parchment mb-4">StatBooks — Iqtiboslar Platformasi</h3>
        <Link
          to={`/search?q=${encodeURIComponent(data.book.title)}`}
          className="btn-primary inline-block px-6 py-2 text-sm"
        >
          Kitob iqtiboslarini ko'rish →
        </Link>
      </div>
    </div>
  );
}
