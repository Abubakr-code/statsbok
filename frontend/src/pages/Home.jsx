import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n';
import api from '../services/api';
import SearchBar from '../components/SearchBar';
import BookPreviewModal from '../components/BookPreviewModal';
import { useAuth } from '../hooks/useAuth';
import SEO from '../components/SEO';

const SAMPLE_QUOTES = [
  { text: 'Kitob — eng yaxshi do\'st. U hech qachon xiyonat qilmaydi.', book: 'Aristotel' },
  { text: 'Kitob o\'qimaslik — ko\'r bo\'lish bilan barobar.', book: 'Alisher Navoiy' },
  { text: 'Bir kitob ming do\'stdan ortiq.', book: 'Sharq maqoli' },
  { text: 'O\'qish — aqlni oziqlantirishdir.', book: 'Francis Bacon' },
  { text: 'Kitoblar — insoniyatning xotirasi.', book: 'Vissarion Belinskiy' },
];

function BookCover({ book, onClick }) {
  const [imgError, setImgError] = useState(false);
  const t = useI18n((s) => s.t);
  return (
    <button onClick={() => onClick(book)} className="group flex flex-col text-left">
      <div className={`relative w-full overflow-hidden rounded-xl shadow-lg transition-all duration-300 group-hover:-translate-y-1.5 group-hover:shadow-2xl group-hover:shadow-amber/10 ${book.coverImage && !imgError ? '' : 'border border-ink-600'}`}>
        <div className="aspect-[2/3]">
          {book.coverImage && !imgError ? (
            <img src={book.coverImage} alt={book.title} loading="lazy" className="h-full w-full object-cover" onError={() => setImgError(true)} />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-ink-700 to-ink-900 p-4 text-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-parchment-faint mb-2">
                <path d="M4 5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v16l-6-3-6 3z" />
              </svg>
              <span className="font-display text-xs text-parchment-faint">{book.title}</span>
            </div>
          )}
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-ink/90 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
        <div className="absolute bottom-0 left-0 right-0 p-3 translate-y-2 opacity-0 transition-all group-hover:translate-y-0 group-hover:opacity-100">
          <span className="text-xs text-amber font-medium">
            {t('search.preview')} →
          </span>
        </div>
      </div>
      <p className="mt-2.5 line-clamp-1 text-sm font-medium text-parchment">{book.title}</p>
      <p className="line-clamp-1 text-xs text-parchment-faint">{book.author}</p>
      {book.likes > 0 && (
        <p className="mt-0.5 text-xs text-amber/80">❤️ {book.likes}</p>
      )}
    </button>
  );
}

export default function Home() {
  const t = useI18n((s) => s.t);
  const lang = useI18n((s) => s.lang);
  const navigate = useNavigate();
  const { isAuthenticated, checked } = useAuth();
  const [books, setBooks] = useState([]);
  const [preview, setPreview] = useState(null);
  const [rotIdx, setRotIdx] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setRotIdx((i) => (i + 1) % SAMPLE_QUOTES.length), 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!checked) return;
    if (!isAuthenticated) {
      setBooks([]);
      return;
    }

    const controller = new AbortController();
    api
      .get(`/books/trending?lang=${lang}`, { signal: controller.signal })
      .then((res) => {
        setBooks(res.data.books || []);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [checked, isAuthenticated, lang]);

  useEffect(() => {
    if (!isAuthenticated) {
      setPreview(null);
    }
  }, [isAuthenticated]);

  const totalQuotes = books.reduce((s, b) => s + (b.totalQuotes || 0), 0);
  const totalBooks = books.length;

  function handleSearch(q) {
    navigate(`/search?q=${encodeURIComponent(q)}`);
  }

  function openPreview(book) {
    setPreview({
      book: { id: book._id, title: book.title, author: book.author, coverImage: book.coverImage, affiliateLink: book.affiliateLink },
      highlightText: null
    });
  }

  return (
    <div>
      <SEO />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            background:
              'radial-gradient(60% 50% at 50% 0%, rgba(232,169,74,0.16) 0%, rgba(26,24,20,0) 70%)'
          }}
        />
        <div className="relative mx-auto max-w-4xl px-4 py-12 text-center sm:py-20">
          <span className="mb-4 inline-block rounded-full border border-amber/30 bg-amber/10 px-3 py-1 text-xs text-amber sm:mb-5 sm:px-4 sm:text-sm">
            {t('footer.tagline')}
          </span>
          <h1 className="mx-auto mb-4 max-w-2xl text-3xl leading-tight text-parchment sm:text-6xl">
            {t('home.title')}
          </h1>
          <div className="mx-auto mb-8 max-w-xl text-base text-parchment-dim sm:mb-10 sm:text-lg">{t('home.subtitle')}</div>
          <SearchBar onSearch={handleSearch} autoFocus />

          {isAuthenticated && books.length > 0 && (
            <div className="mx-auto mt-6 grid max-w-md grid-cols-2 gap-3 text-left">
              <div className="rounded-xl border border-ink-600 bg-ink-800/80 p-3">
                <p className="text-xs uppercase tracking-wide text-parchment-faint">{t('home.stats.quotesLabel')}</p>
                <p className="mt-1 text-2xl font-display text-amber">{totalQuotes.toLocaleString()}</p>
              </div>
              <div className="rounded-xl border border-ink-600 bg-ink-800/80 p-3">
                <p className="text-xs uppercase tracking-wide text-parchment-faint">{t('home.stats.booksLabel')}</p>
                <p className="mt-1 text-2xl font-display text-amber">{totalBooks.toLocaleString()}</p>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 border-t border-ink-700">
        <div className="mx-auto max-w-4xl px-4">
          <h2 className="text-2xl font-display text-parchment text-center mb-10">{t('home.howItWorks.title')}</h2>
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
            {[
              { num: '01', icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3"/></svg>, title: t('home.howItWorks.s1'), desc: t('home.howItWorks.s1d') },
              { num: '02', icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>, title: t('home.howItWorks.s2'), desc: t('home.howItWorks.s2d') },
              { num: '03', icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M19 21H5a2 2 0 0 1-2-2V7l4-4h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2z"/><path d="M9 21V12h6v9"/></svg>, title: t('home.howItWorks.s3'), desc: t('home.howItWorks.s3d') },
            ].map((step) => (
              <div key={step.num} className="flex flex-col items-center text-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber/10 text-amber border border-amber/20">
                  {step.icon}
                </div>
                <div>
                  <p className="text-xs text-amber font-mono mb-1">{step.num}</p>
                  <h3 className="font-display text-lg text-parchment mb-2">{step.title}</h3>
                  <p className="text-sm text-parchment-faint leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Rotating quotes — shown to guests */}
      {!isAuthenticated && (
        <section className="py-12 bg-ink-800/50 border-t border-ink-700">
          <div className="mx-auto max-w-2xl px-4 text-center">
            <p className="text-xs uppercase tracking-widest text-parchment-faint mb-6">{t('home.rotating.title')}</p>
            <blockquote className="transition-all duration-500 min-h-[80px]">
              <p className="font-display text-xl text-parchment italic leading-relaxed mb-3">
                "{SAMPLE_QUOTES[rotIdx].text}"
              </p>
              <cite className="text-sm text-amber not-italic">— {SAMPLE_QUOTES[rotIdx].book}</cite>
            </blockquote>
            <div className="flex justify-center gap-2 mt-6">
              {SAMPLE_QUOTES.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setRotIdx(i)}
                  className={`h-1.5 rounded-full transition-all duration-300 ${i === rotIdx ? 'w-6 bg-amber' : 'w-1.5 bg-ink-500'}`}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Database books - 4x4 grid with covers */}
      {isAuthenticated && books.length > 0 && (
        <section className="py-8">
          <div className="mx-auto max-w-5xl px-4">
            <div className="mb-8">
              <h2 className="text-2xl font-display text-parchment">{t('home.books.title')}</h2>
              <p className="text-sm text-parchment-dim mt-1">{t('home.books.quotes', { n: totalQuotes.toLocaleString() })}</p>
            </div>
            <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
              {books.slice(0, 16).map((b) => (
                <BookCover key={b._id} book={b} onClick={openPreview} />
              ))}
            </div>
          </div>
        </section>
      )}

      {preview && (
        <BookPreviewModal
          book={preview.book}
          highlightText={preview.highlightText}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  );
}
