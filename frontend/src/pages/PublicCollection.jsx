import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';
import SEO from '../components/SEO';

export default function PublicCollection() {
  const { slug }    = useParams();
  const [col, setCol]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(false);

  useEffect(() => {
    api.get(`/public/collection/${slug}`)
      .then((r) => setCol(r.data.collection))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) return (
    <div className="py-24 text-center text-parchment-dim">Yuklanmoqda…</div>
  );

  if (error || !col) return (
    <div className="py-24 text-center">
      <p className="text-parchment text-xl mb-2">To'plam topilmadi</p>
      <p className="text-parchment-dim text-sm">Bu to'plam mavjud emas yoki yopiq.</p>
      <Link to="/" className="mt-4 inline-block text-amber hover:underline text-sm">Bosh sahifaga qaytish</Link>
    </div>
  );

  const blogger = col.blogger || {};
  const bp      = blogger.bloggerProfile || {};

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <SEO title={col.name || "To'plam"} />
      {/* Blogger info */}
      <div className="mb-6 flex items-center gap-3">
        {blogger.avatarUrl
          ? <img src={blogger.avatarUrl} alt={blogger.name} className="h-10 w-10 rounded-full object-cover" />
          : <div className="h-10 w-10 rounded-full bg-ink-700 flex items-center justify-center text-amber">👤</div>
        }
        <div>
          <p className="text-parchment text-sm font-medium">
            {blogger.name}
            {bp.verifiedBadge && <span className="ml-1 text-amber text-xs">✓</span>}
          </p>
          {bp.channelName && (
            <a href={bp.channelLink || '#'} target="_blank" rel="noopener noreferrer"
               className="text-xs text-parchment-dim hover:text-amber">
              {bp.channelName}
            </a>
          )}
        </div>
        <Link to="/bloggers" className="ml-auto text-xs text-parchment-faint hover:text-amber">
          Barcha bloggerlar →
        </Link>
      </div>

      {/* Collection header */}
      <div className="mb-8">
        <h1 className="text-3xl font-display text-parchment">{col.title}</h1>
        {col.niche && <p className="mt-1 text-sm text-amber">#{col.niche}</p>}
        <p className="mt-2 text-xs text-parchment-faint">
          {col.quotes?.length || 0} ta stata · {col.views || 0} ko'rish
        </p>
      </div>

      {/* Quotes */}
      {(!col.quotes || col.quotes.length === 0) ? (
        <p className="text-center text-parchment-dim py-10">Bu to'plamda hali statalar yo'q.</p>
      ) : (
        <div className="space-y-4">
          {col.quotes.map((q) => {
            if (!q || !q.text) return null;
            const book = q.bookId || {};
            return (
              <article key={q._id} className="card border border-ink-600">
                <blockquote className="text-parchment text-sm leading-relaxed italic">
                  "{q.text}"
                </blockquote>
                {(book.titleUz || book.title || book.author) && (
                  <p className="mt-3 text-xs text-parchment-faint">
                    — {book.author && `${book.author}, `}{book.titleUz || book.title}
                  </p>
                )}
              </article>
            );
          })}
        </div>
      )}

      {/* Footer CTA */}
      <div className="mt-12 rounded-xl border border-ink-600 p-6 text-center">
        <p className="text-parchment mb-2">Iqtibos qaysi kitobdan ekanini bilmoqchimisiz?</p>
        <Link to="/" className="btn-primary inline-block text-sm px-5 py-2">
          StatBooks da qidirish
        </Link>
      </div>
    </div>
  );
}
