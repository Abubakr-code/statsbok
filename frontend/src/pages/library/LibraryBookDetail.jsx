import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useI18n } from '../../i18n';
import { useAuth } from '../../hooks/useAuth';
import { useToastStore } from '../../store/toastStore';
import SEO from '../../components/SEO';
import api from '../../services/api';

const TABS = ['progress', 'insights', 'review', 'quotes'];
const TAB_LABELS = {
  progress: { uz: 'Jarayon', en: 'Progress', ru: 'Прогресс' },
  insights: { uz: 'Tushunchalar', en: 'Insights', ru: 'Заметки' },
  review: { uz: 'Taqriz', en: 'Review', ru: 'Рецензия' },
  quotes: { uz: 'Statalar', en: 'Quotes', ru: 'Цитаты' }
};

function StarSelect({ value, onChange }) {
  return (
    <div className="flex gap-1">
      {[1,2,3,4,5].map((n) => (
        <button key={n} onClick={() => onChange(n)}
          className={`text-xl transition-colors ${n <= (value||0) ? 'text-amber' : 'text-ink-600 hover:text-amber/60'}`}>★</button>
      ))}
    </div>
  );
}

export default function LibraryBookDetail() {
  const { id } = useParams();
  const { t, lang } = useI18n((s) => ({ t: s.t, lang: s.lang }));
  const { isPremium } = useAuth();
  const navigate = useNavigate();
  const showToast = useToastStore((s) => s.show);

  const [book, setBook] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('progress');

  // Progress
  const [newPage, setNewPage] = useState('');
  const [sessionPages, setSessionPages] = useState('');
  const [sessionMins, setSessionMins] = useState('');

  // Insights
  const [insightText, setInsightText] = useState('');
  const [insightPage, setInsightPage] = useState('');

  // Review
  const [reviewText, setReviewText] = useState('');
  const [reviewSaving, setReviewSaving] = useState(false);

  useEffect(() => {
    api.get(`/library/${id}`).then(({ data }) => {
      setBook(data.book);
      setReviewText(data.book.review?.text || '');
    }).catch(() => navigate('/library')).finally(() => setLoading(false));
  }, [id]);

  async function saveProgress() {
    if (!newPage) return;
    try {
      const { data } = await api.patch(`/library/${id}/progress`, { currentPage: parseInt(newPage) });
      setBook(data.book); setNewPage('');
      showToast('Sahifa yangilandi', 'success');
    } catch { showToast(t('toast.error'), 'error'); }
  }

  async function logSession() {
    if (!sessionPages && !sessionMins) return;
    try {
      const { data } = await api.post(`/library/${id}/session`, {
        pagesRead: parseInt(sessionPages) || 0,
        minutesRead: parseInt(sessionMins) || 0,
        currentPage: newPage ? parseInt(newPage) : undefined
      });
      setBook(data.book); setSessionPages(''); setSessionMins(''); setNewPage('');
      showToast("O'qish sessiyasi saqlandi", 'success');
    } catch { showToast(t('toast.error'), 'error'); }
  }

  async function addInsight() {
    if (!insightText.trim()) return;
    try {
      const { data } = await api.post(`/library/${id}/insights`, {
        text: insightText.trim(),
        pageNumber: insightPage ? parseInt(insightPage) : undefined
      });
      setBook(data.book); setInsightText(''); setInsightPage('');
      showToast('Tushuncha saqlandi', 'success');
    } catch (err) {
      if (err.response?.data?.error === 'insight_limit_reached') {
        showToast(t('library.freeLimit'), 'error');
      } else showToast(t('toast.error'), 'error');
    }
  }

  async function deleteInsight(iid) {
    try {
      const { data } = await api.delete(`/library/${id}/insights/${iid}`);
      setBook(data.book);
    } catch { showToast(t('toast.error'), 'error'); }
  }

  async function saveReview() {
    setReviewSaving(true);
    try {
      const { data } = await api.put(`/library/${id}/review`, { text: reviewText });
      setBook(data.book);
      showToast(t('toast.saved'), 'success');
    } catch (err) {
      if (err.response?.data?.error === 'review_too_long') {
        showToast('Taqriz 500 belgidan oshib ketdi (Premium kerak)', 'error');
      } else showToast(t('toast.error'), 'error');
    } finally { setReviewSaving(false); }
  }

  async function toggleReviewPublic() {
    try {
      const { data } = await api.patch(`/library/${id}/review/toggle`);
      setBook((b) => ({ ...b, review: { ...b.review, isPublic: data.isPublic } }));
      showToast(data.isPublic ? 'Taqriz ommaga ochildi' : 'Taqriz yopildi', 'success');
    } catch (err) {
      if (err.response?.data?.error === 'premium_required') showToast('Bu funksiya Premium uchun', 'error');
      else showToast(t('toast.error'), 'error');
    }
  }

  if (loading) return <div className="py-24 text-center text-parchment-dim">{t('common.loading')}</div>;
  if (!book) return null;

  const progress = book.totalPages && book.currentPage ? Math.round((book.currentPage / book.totalPages) * 100) : 0;
  const recentSessions = [...(book.readingSessions || [])].reverse().slice(0, 5);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <SEO title={`${book.title} — ${book.author}`} />
      <Link to="/library" className="inline-flex items-center gap-1 text-sm text-parchment-faint hover:text-parchment mb-6">
        ← {t('library.title')}
      </Link>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[220px_1fr]">
        {/* Left: Cover + Info */}
        <div>
          {book.coverUrl ? (
            <img src={book.coverUrl} alt={book.title} className="w-full max-w-[220px] rounded-xl shadow-lg mb-4" />
          ) : (
            <div className="aspect-[2/3] max-w-[220px] rounded-xl border border-ink-600 bg-gradient-to-br from-ink-700 to-ink-900 flex items-center justify-center mb-4">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-parchment-faint">
                <path d="M4 5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v16l-6-3-6 3z" />
              </svg>
            </div>
          )}
          <h1 className="font-display text-xl text-parchment mb-1">{book.title}</h1>
          <p className="text-sm text-parchment-dim mb-2">{book.author}</p>
          {book.year && <p className="text-xs text-parchment-faint">{book.year}</p>}
          {book.genre && <p className="text-xs text-parchment-faint mt-1">{book.genre}</p>}
          {book.rating && (
            <div className="flex gap-0.5 mt-2">
              {[1,2,3,4,5].map((i) => (
                <span key={i} className={`text-base ${i <= book.rating ? 'text-amber' : 'text-ink-600'}`}>★</span>
              ))}
            </div>
          )}
          {book.totalPages && (
            <p className="text-xs text-parchment-faint mt-2">{book.currentPage || 0}/{book.totalPages} sahifa</p>
          )}
        </div>

        {/* Right: Tabs */}
        <div>
          <div className="flex gap-1 mb-6 border-b border-ink-600 pb-2 overflow-x-auto">
            {TABS.map((tabId) => (
              <button key={tabId} onClick={() => setTab(tabId)}
                className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${tab === tabId ? 'bg-amber/20 text-amber' : 'text-parchment-dim hover:text-parchment'}`}>
                {TAB_LABELS[tabId][lang] || TAB_LABELS[tabId].en}
              </button>
            ))}
          </div>

          {/* PROGRESS TAB */}
          {tab === 'progress' && (
            <div className="space-y-6">
              {book.totalPages && (
                <div>
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-parchment-dim">{book.currentPage}/{book.totalPages} sahifa</span>
                    <span className="text-amber font-medium">{progress}%</span>
                  </div>
                  <div className="h-3 rounded-full bg-ink-700">
                    <div className="h-full rounded-full bg-amber transition-all" style={{ width: `${progress}%` }} />
                  </div>
                </div>
              )}
              <div className="card space-y-3">
                <h3 className="text-sm font-medium text-parchment">O'qish sessiyasi qo'shish</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-parchment-faint mb-1 block">O'qilgan sahifalar</label>
                    <input type="number" value={sessionPages} onChange={(e) => setSessionPages(e.target.value)}
                      className="w-full rounded-lg border border-ink-600 bg-ink-800 px-3 py-2 text-sm text-parchment outline-none focus:border-amber" />
                  </div>
                  <div>
                    <label className="text-xs text-parchment-faint mb-1 block">O'qish vaqti (daqiqa)</label>
                    <input type="number" value={sessionMins} onChange={(e) => setSessionMins(e.target.value)}
                      className="w-full rounded-lg border border-ink-600 bg-ink-800 px-3 py-2 text-sm text-parchment outline-none focus:border-amber" />
                  </div>
                  <div>
                    <label className="text-xs text-parchment-faint mb-1 block">Joriy sahifa</label>
                    <input type="number" value={newPage} onChange={(e) => setNewPage(e.target.value)}
                      className="w-full rounded-lg border border-ink-600 bg-ink-800 px-3 py-2 text-sm text-parchment outline-none focus:border-amber" />
                  </div>
                  <div className="flex items-end">
                    <button onClick={logSession} className="btn-primary w-full py-2 text-sm">Saqlash</button>
                  </div>
                </div>
              </div>

              {recentSessions.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-parchment mb-3">Oxirgi sessiyalar</h3>
                  <div className="space-y-2">
                    {recentSessions.map((s, i) => (
                      <div key={i} className="flex items-center justify-between text-sm border-b border-ink-700 pb-2">
                        <span className="text-parchment-faint">{new Date(s.date).toLocaleDateString()}</span>
                        <span className="text-parchment">{s.pagesRead} sahifa</span>
                        <span className="text-parchment-faint">{s.minutesRead} daqiqa</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* INSIGHTS TAB */}
          {tab === 'insights' && (
            <div className="space-y-4">
              <div className="card space-y-3">
                <textarea value={insightText} onChange={(e) => setInsightText(e.target.value)}
                  rows={3} placeholder="Muhim fikr yoki tushuncha..."
                  className="w-full resize-none rounded-lg border border-ink-600 bg-ink-800 px-3 py-2 text-sm text-parchment placeholder-parchment-faint outline-none focus:border-amber" />
                <div className="flex gap-3 items-center">
                  <input type="number" value={insightPage} onChange={(e) => setInsightPage(e.target.value)}
                    placeholder="Sahifa (ixtiyoriy)"
                    className="w-32 rounded-lg border border-ink-600 bg-ink-800 px-3 py-2 text-sm text-parchment outline-none focus:border-amber" />
                  <button onClick={addInsight} className="btn-primary px-4 py-2 text-sm">Qo'shish</button>
                </div>
              </div>
              {(book.insights || []).length === 0 && (
                <p className="text-sm text-parchment-faint text-center py-6">Hali tushuncha yo'q</p>
              )}
              <div className="space-y-3">
                {[...(book.insights || [])].reverse().map((ins) => (
                  <div key={ins._id} className="card flex items-start gap-3">
                    {ins.pageNumber && (
                      <span className="text-xs text-amber font-mono flex-shrink-0 mt-1">{ins.pageNumber}-bet</span>
                    )}
                    <p className="flex-1 text-sm text-parchment leading-relaxed">{ins.text}</p>
                    <button onClick={() => deleteInsight(ins._id)}
                      className="flex-shrink-0 text-parchment-faint hover:text-red-400 transition-colors">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 6 6 18M6 6l12 12"/>
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* REVIEW TAB */}
          {tab === 'review' && (
            <div className="space-y-4">
              <div>
                <label className="text-xs text-parchment-faint mb-1 block">Baho</label>
                <StarSelect value={book.rating} onChange={async (r) => {
                  const { data } = await api.put(`/library/${id}`, { rating: r });
                  setBook(data.book);
                }} />
              </div>
              <div>
                <label className="text-xs text-parchment-faint mb-2 block">
                  Taqriz {!isPremium && <span className="text-amber">(max 500 belgi bepul)</span>}
                </label>
                <textarea value={reviewText} onChange={(e) => setReviewText(e.target.value)}
                  rows={8} placeholder="Kitob haqida fikrlaringiz..."
                  className="w-full resize-none rounded-xl border border-ink-600 bg-ink-800 px-4 py-3 text-sm text-parchment placeholder-parchment-faint outline-none focus:border-amber" />
                {!isPremium && <p className="text-xs text-parchment-faint mt-1">{reviewText.length}/500</p>}
              </div>
              <div className="flex gap-3">
                <button onClick={saveReview} disabled={reviewSaving} className="btn-primary px-6 py-2 text-sm">
                  {reviewSaving ? '...' : 'Saqlash'}
                </button>
                {isPremium && book.review?.text && (
                  <button onClick={toggleReviewPublic} className="btn-ghost px-4 py-2 text-sm">
                    {book.review?.isPublic ? '🔒 Yopish' : '🌐 Ommaga ochish'}
                  </button>
                )}
              </div>
              {book.review?.isPublic && book.review?.publicSlug && (
                <div className="card text-sm">
                  <p className="text-parchment-faint mb-2">Ommaviy havola:</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-amber text-xs break-all">
                      /review/{book.review.publicSlug}
                    </code>
                    <button onClick={() => { navigator.clipboard?.writeText(window.location.origin + '/review/' + book.review.publicSlug); showToast(t('toast.copied'), 'info'); }}
                      className="btn-ghost px-2 py-1 text-xs">Nusxa</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* QUOTES TAB */}
          {tab === 'quotes' && (
            <div className="py-8 text-center text-parchment-faint">
              <p className="text-sm">StatBooks bazasida shu kitob statalarini qidirish uchun:</p>
              <Link to={`/search?q=${encodeURIComponent(book.title)}`} className="btn-ghost mt-3 inline-block px-4 py-2 text-sm">
                StatBooks da qidirish →
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
