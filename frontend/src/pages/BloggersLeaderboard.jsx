import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import SEO from '../components/SEO';
import { useAuth } from '../hooks/useAuth';

export default function BloggersLeaderboard() {
  const [bloggers, setBloggers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [followLoading, setFollowLoading] = useState({});
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    api.get('/public/bloggers')
      .then((r) => setBloggers(r.data.bloggers || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function toggleFollow(blogger) {
    if (!isAuthenticated) return;
    const id = blogger._id;
    setFollowLoading((p) => ({ ...p, [id]: true }));
    try {
      const isFollowing = blogger._isFollowing;
      const { data } = isFollowing
        ? await api.delete(`/public/bloggers/${id}/follow`)
        : await api.post(`/public/bloggers/${id}/follow`);
      setBloggers((prev) =>
        prev.map((b) =>
          b._id === id
            ? { ...b, _isFollowing: data.following, _followerCount: data.followerCount }
            : b
        )
      );
    } catch {
      /* ignore */
    } finally {
      setFollowLoading((p) => ({ ...p, [id]: false }));
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <SEO title="Bloggerlar" description="StatBooks bloggerlar reytingi — eng faol kitob bloggerlari." />
      {/* Header */}
      <div className="mb-10 text-center">
        <h1 className="text-4xl font-display text-parchment mb-2">O'zbek Kitob Bloggerlari</h1>
        <p className="text-parchment-dim max-w-xl mx-auto">
          StatBooks bilan hamkorlik qiluvchi va kitobsevarlarga iqtiboslar ulashuvchi blogger jamoasi.
        </p>
        <Link to="/blogger" className="mt-4 inline-block btn-primary text-sm px-5 py-2">
          ✋ Blogger bo'lish
        </Link>
      </div>

      {loading && (
        <div className="py-20 text-center text-parchment-dim">Yuklanmoqda…</div>
      )}

      {!loading && bloggers.length === 0 && (
        <div className="py-20 text-center">
          <p className="text-parchment-dim">Hali blogger ro'yxati bo'sh.</p>
          <p className="text-parchment-faint text-sm mt-2">Birinchi bo'lish uchun ariza yuboring!</p>
        </div>
      )}

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {bloggers.map((b, i) => {
          const bp = b.bloggerProfile || {};
          return (
            <div key={b._id} className="card border border-ink-600 flex flex-col gap-3">
              {/* Rank badge */}
              <div className="flex items-start justify-between">
                <span className={`text-xs rounded-full px-2 py-0.5 ${
                  i === 0 ? 'bg-amber text-ink-900' :
                  i === 1 ? 'bg-ink-500 text-parchment' :
                  i === 2 ? 'bg-amber/30 text-amber' :
                  'bg-ink-700 text-parchment-faint'
                }`}>
                  #{i + 1}
                </span>
                {bp.verifiedBadge && (
                  <span className="text-amber text-xs">✓ Tasdiqlangan</span>
                )}
              </div>

              {/* Avatar + name */}
              <div className="flex items-center gap-3">
                {b.avatarUrl
                  ? <img src={b.avatarUrl} alt={b.name} className="h-12 w-12 rounded-full object-cover" />
                  : <div className="h-12 w-12 rounded-full bg-ink-700 flex items-center justify-center text-xl">👤</div>
                }
                <div>
                  <p className="text-parchment font-medium">{b.name}</p>
                  {bp.channelName && (
                    <a
                      href={bp.channelLink || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-amber hover:underline"
                    >
                      {bp.channelName}
                    </a>
                  )}
                </div>
              </div>

              {/* Niche */}
              {bp.niche && (
                <p className="text-xs text-parchment-faint">#{bp.niche}</p>
              )}

              {/* Bio */}
              {bp.bio && (
                <p className="text-xs text-parchment-dim line-clamp-2">{bp.bio}</p>
              )}

              {/* Stats */}
              <div className="flex flex-wrap gap-3 text-xs text-parchment-faint border-t border-ink-600 pt-2">
                {bp.followers > 0 && (
                  <span>👥 {bp.followers.toLocaleString()} obunachi</span>
                )}
                {(b._followerCount ?? 0) > 0 && (
                  <span>❤️ {(b._followerCount ?? 0).toLocaleString()} kuzatuvchi</span>
                )}
                {b.collectionsCount > 0 && (
                  <span>🎯 {b.collectionsCount} to'plam</span>
                )}
                {b.collectionsCount > 0 && b.totalCollectionViews > 0 && (
                  <span>👁 {b.totalCollectionViews} ko'rilgan</span>
                )}
              </div>

              {/* Follow button */}
              {isAuthenticated && (
                <button
                  onClick={() => toggleFollow(b)}
                  disabled={!!followLoading[b._id]}
                  className={`w-full rounded-lg py-1.5 text-xs font-medium transition-all ${
                    b._isFollowing
                      ? 'border border-ink-500 bg-transparent text-parchment-faint hover:border-red-500/50 hover:text-red-400'
                      : 'bg-amber/15 text-amber border border-amber/30 hover:bg-amber/25'
                  } disabled:opacity-50`}
                >
                  {followLoading[b._id]
                    ? '...'
                    : b._isFollowing
                    ? '✓ Kuzatilmoqda'
                    : '+ Kuzatish'}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* About section */}
      <div className="mt-16 rounded-xl border border-ink-600 p-8 text-center">
        <h2 className="text-2xl font-display text-parchment mb-3">Blogger bo'lishning afzalliklari</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mt-6 text-left">
          {[
            { icon: '🎯', title: "To'plamlar", desc: "O'z brend to'plamlaringizni yarating" },
            { icon: '🔧', title: 'Widget', desc: "Blogingizga qidiruv widget'ini qo'ying (Premium)" },
            { icon: '📊', title: 'Statistika', desc: "Widget bosilishi va ko'rishlar tahlili" },
            { icon: '✓',  title: 'Nishon', desc: '"Tasdiqlangan blogger" nishoni oling' }
          ].map((item) => (
            <div key={item.title} className="card bg-ink-800/50">
              <p className="text-2xl mb-2">{item.icon}</p>
              <p className="text-parchment text-sm font-medium">{item.title}</p>
              <p className="text-parchment-faint text-xs mt-1">{item.desc}</p>
            </div>
          ))}
        </div>
        <Link to="/blogger" className="mt-6 inline-block btn-primary text-sm px-6 py-2">
          Ariza yuborish
        </Link>
      </div>
    </div>
  );
}
