import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import SEO from '../../components/SEO';

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

  if (loading) return <div className="py-24 text-center text-parchment-faint">Yuklanmoqda...</div>;
  if (notFound) return (
    <div className="py-24 text-center">
      <p className="text-parchment-dim mb-4">Taqriz topilmadi yoki yopiq.</p>
      <Link to="/" className="btn-ghost px-4 py-2">Bosh sahifa</Link>
    </div>
  );

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <SEO title={`${data.book.title} — ${data.user.name} taqrizi`} description={data.review.text?.slice(0, 150)} />

      <div className="flex items-center gap-3 mb-8">
        {data.user.avatarUrl && <img src={data.user.avatarUrl} alt="" className="w-10 h-10 rounded-full" />}
        <div>
          <p className="text-sm text-parchment font-medium">{data.user.name}</p>
          <p className="text-xs text-parchment-faint">{new Date(data.review.createdAt).toLocaleDateString()}</p>
        </div>
      </div>

      <div className="flex items-start gap-5 mb-8">
        {data.book.coverUrl && <img src={data.book.coverUrl} alt="" className="w-20 rounded-lg shadow-lg flex-shrink-0" />}
        <div>
          <h1 className="font-display text-2xl text-parchment mb-1">{data.book.title}</h1>
          <p className="text-parchment-dim mb-2">{data.book.author}</p>
          {data.book.rating && (
            <div className="flex gap-0.5">
              {[1,2,3,4,5].map((i) => <span key={i} className={`${i <= data.book.rating ? 'text-amber' : 'text-ink-600'}`}>★</span>)}
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <p className="text-parchment leading-relaxed whitespace-pre-wrap">{data.review.text}</p>
      </div>

      <div className="mt-8 text-center">
        <Link to="/" className="text-sm text-amber hover:underline">StatBooks — Iqtiboslar qidiruvi →</Link>
      </div>
    </div>
  );
}
