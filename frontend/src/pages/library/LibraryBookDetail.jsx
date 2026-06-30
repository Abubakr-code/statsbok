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

// Local strings for this page (kept inline to avoid scattering across i18n).
const L = {
  uz: {
    pages: 'sahifa', minutes: 'daqiqa', bet: 'bet',
    addSession: "O'qish sessiyasi qo'shish", pagesRead: "O'qilgan sahifalar",
    readTime: "O'qish vaqti (daqiqa)", currentPage: 'Joriy sahifa', save: 'Saqlash',
    recentSessions: 'Oxirgi sessiyalar', insightPh: 'Muhim fikr yoki tushuncha...',
    pageOpt: 'Sahifa (ixtiyoriy)', add: "Qo'shish", noInsights: "Hali tushuncha yo'q",
    rating: 'Baho', reviewLabel: 'Taqriz', freeMax: '(max 500 belgi bepul)',
    reviewPh: 'Kitob haqida fikrlaringiz...', makePublic: '🌐 Ommaga ochish',
    makePrivate: '🔒 Yopish', publicLink: 'Ommaviy havola:', copy: 'Nusxa',
    quotesHint: 'Shu kitob statalarini StatBooks bazasidan qidirish:', searchOn: 'StatBooks da qidirish →',
    readPdf: '📖 PDF o‘qish', pageSaved: 'Sahifa yangilandi', sessionSaved: "O'qish sessiyasi saqlandi",
    insightSaved: 'Tushuncha saqlandi', reviewLong: 'Taqriz 500 belgidan oshdi (Premium kerak)',
    reviewOpened: 'Taqriz ommaga ochildi', reviewClosed: 'Taqriz yopildi', premiumOnly: 'Bu funksiya Premium uchun'
  },
  ru: {
    pages: 'стр.', minutes: 'мин', bet: 'стр.',
    addSession: 'Добавить сессию чтения', pagesRead: 'Прочитано страниц',
    readTime: 'Время чтения (мин)', currentPage: 'Текущая страница', save: 'Сохранить',
    recentSessions: 'Последние сессии', insightPh: 'Важная мысль или заметка...',
    pageOpt: 'Страница (необяз.)', add: 'Добавить', noInsights: 'Пока нет заметок',
    rating: 'Оценка', reviewLabel: 'Рецензия', freeMax: '(до 500 символов бесплатно)',
    reviewPh: 'Ваши мысли о книге...', makePublic: '🌐 Опубликовать',
    makePrivate: '🔒 Скрыть', publicLink: 'Публичная ссылка:', copy: 'Копировать',
    quotesHint: 'Искать цитаты этой книги в базе StatBooks:', searchOn: 'Искать в StatBooks →',
    readPdf: '📖 Читать PDF', pageSaved: 'Страница обновлена', sessionSaved: 'Сессия сохранена',
    insightSaved: 'Заметка сохранена', reviewLong: 'Рецензия больше 500 символов (нужен Premium)',
    reviewOpened: 'Рецензия опубликована', reviewClosed: 'Рецензия скрыта', premiumOnly: 'Функция только для Premium'
  },
  en: {
    pages: 'pages', minutes: 'min', bet: 'p.',
    addSession: 'Add reading session', pagesRead: 'Pages read',
    readTime: 'Reading time (min)', currentPage: 'Current page', save: 'Save',
    recentSessions: 'Recent sessions', insightPh: 'An important thought or note...',
    pageOpt: 'Page (optional)', add: 'Add', noInsights: 'No insights yet',
    rating: 'Rating', reviewLabel: 'Review', freeMax: '(max 500 chars free)',
    reviewPh: 'Your thoughts about the book...', makePublic: '🌐 Make public',
    makePrivate: '🔒 Make private', publicLink: 'Public link:', copy: 'Copy',
    quotesHint: 'Search this book\'s quotes in the StatBooks database:', searchOn: 'Search on StatBooks →',
    readPdf: '📖 Read PDF', pageSaved: 'Page updated', sessionSaved: 'Reading session saved',
    insightSaved: 'Insight saved', reviewLong: 'Review over 500 chars (Premium required)',
    reviewOpened: 'Review made public', reviewClosed: 'Review hidden', premiumOnly: 'This feature is Premium only'
  }
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
  const x = L[lang] || L.uz;

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
      showToast(x.pageSaved, 'success');
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
      showToast(x.sessionSaved, 'success');
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
      showToast(x.insightSaved, 'success');
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
        showToast(x.reviewLong, 'error');
      } else showToast(t('toast.error'), 'error');
    } finally { setReviewSaving(false); }
  }

  async function toggleReviewPublic() {
    try {
      const { data } = await api.patch(`/library/${id}/review/toggle`);
      setBook((b) => ({ ...b, review: { ...b.review, isPublic: data.isPublic } }));
      showToast(data.isPublic ? x.reviewOpened : x.reviewClosed, 'success');
    } catch (err) {
      if (err.response?.data?.error === 'premium_required') showToast(x.premiumOnly, 'error');
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
            <p className="text-xs text-parchment-faint mt-2">{book.currentPage || 0}/{book.totalPages} {x.pages}</p>
          )}
          {book.pdfFileId && (
            <a
              href={`/api/library/${book._id}/pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary mt-4 flex w-full items-center justify-center gap-2 py-2 text-sm"
            >
              {x.readPdf}
            </a>
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
                    <span className="text-parchment-dim">{book.currentPage}/{book.totalPages} {x.pages}</span>
                    <span className="text-amber font-medium">{progress}%</span>
                  </div>
                  <div className="h-3 rounded-full bg-ink-700">
                    <div className="h-full rounded-full bg-amber transition-all" style={{ width: `${progress}%` }} />
                  </div>
                </div>
              )}
              <div className="card space-y-3">
                <h3 className="text-sm font-medium text-parchment">{x.addSession}</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-parchment-faint mb-1 block">{x.pagesRead}</label>
                    <input type="number" value={sessionPages} onChange={(e) => setSessionPages(e.target.value)}
                      className="w-full rounded-lg border border-ink-600 bg-ink-800 px-3 py-2 text-sm text-parchment outline-none focus:border-amber" />
                  </div>
                  <div>
                    <label className="text-xs text-parchment-faint mb-1 block">{x.readTime}</label>
                    <input type="number" value={sessionMins} onChange={(e) => setSessionMins(e.target.value)}
                      className="w-full rounded-lg border border-ink-600 bg-ink-800 px-3 py-2 text-sm text-parchment outline-none focus:border-amber" />
                  </div>
                  <div>
                    <label className="text-xs text-parchment-faint mb-1 block">{x.currentPage}</label>
                    <input type="number" value={newPage} onChange={(e) => setNewPage(e.target.value)}
                      className="w-full rounded-lg border border-ink-600 bg-ink-800 px-3 py-2 text-sm text-parchment outline-none focus:border-amber" />
                  </div>
                  <div className="flex items-end">
                    <button onClick={logSession} className="btn-primary w-full py-2 text-sm">{x.save}</button>
                  </div>
                </div>
              </div>

              {recentSessions.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-parchment mb-3">{x.recentSessions}</h3>
                  <div className="space-y-2">
                    {recentSessions.map((s, i) => (
                      <div key={i} className="flex items-center justify-between text-sm border-b border-ink-700 pb-2">
                        <span className="text-parchment-faint">{new Date(s.date).toLocaleDateString()}</span>
                        <span className="text-parchment">{s.pagesRead} {x.pages}</span>
                        <span className="text-parchment-faint">{s.minutesRead} {x.minutes}</span>
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
                  rows={3} placeholder={x.insightPh}
                  className="w-full resize-none rounded-lg border border-ink-600 bg-ink-800 px-3 py-2 text-sm text-parchment placeholder-parchment-faint outline-none focus:border-amber" />
                <div className="flex gap-3 items-center">
                  <input type="number" value={insightPage} onChange={(e) => setInsightPage(e.target.value)}
                    placeholder={x.pageOpt}
                    className="w-32 rounded-lg border border-ink-600 bg-ink-800 px-3 py-2 text-sm text-parchment outline-none focus:border-amber" />
                  <button onClick={addInsight} className="btn-primary px-4 py-2 text-sm">{x.add}</button>
                </div>
              </div>
              {(book.insights || []).length === 0 && (
                <p className="text-sm text-parchment-faint text-center py-6">{x.noInsights}</p>
              )}
              <div className="space-y-3">
                {[...(book.insights || [])].reverse().map((ins) => (
                  <div key={ins._id} className="card flex items-start gap-3">
                    {ins.pageNumber && (
                      <span className="text-xs text-amber font-mono flex-shrink-0 mt-1">{ins.pageNumber}-{x.bet}</span>
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
                <label className="text-xs text-parchment-faint mb-1 block">{x.rating}</label>
                <StarSelect value={book.rating} onChange={async (r) => {
                  const { data } = await api.put(`/library/${id}`, { rating: r });
                  setBook(data.book);
                }} />
              </div>
              <div>
                <label className="text-xs text-parchment-faint mb-2 block">
                  {x.reviewLabel} {!isPremium && <span className="text-amber">{x.freeMax}</span>}
                </label>
                <textarea value={reviewText} onChange={(e) => setReviewText(e.target.value)}
                  rows={8} placeholder={x.reviewPh}
                  className="w-full resize-none rounded-xl border border-ink-600 bg-ink-800 px-4 py-3 text-sm text-parchment placeholder-parchment-faint outline-none focus:border-amber" />
                {!isPremium && <p className="text-xs text-parchment-faint mt-1">{reviewText.length}/500</p>}
              </div>
              <div className="flex gap-3">
                <button onClick={saveReview} disabled={reviewSaving} className="btn-primary px-6 py-2 text-sm">
                  {reviewSaving ? '...' : x.save}
                </button>
                {isPremium && book.review?.text && (
                  <button onClick={toggleReviewPublic} className="btn-ghost px-4 py-2 text-sm">
                    {book.review?.isPublic ? x.makePrivate : x.makePublic}
                  </button>
                )}
              </div>
              {book.review?.isPublic && book.review?.publicSlug && (
                <div className="card text-sm">
                  <p className="text-parchment-faint mb-2">{x.publicLink}</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-amber text-xs break-all">
                      /review/{book.review.publicSlug}
                    </code>
                    <button onClick={() => { navigator.clipboard?.writeText(window.location.origin + '/review/' + book.review.publicSlug); showToast(t('toast.copied'), 'info'); }}
                      className="btn-ghost px-2 py-1 text-xs">{x.copy}</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* QUOTES TAB */}
          {tab === 'quotes' && (
            <div className="py-8 text-center text-parchment-faint">
              <p className="text-sm">{x.quotesHint}</p>
              <Link to={`/search?q=${encodeURIComponent(book.title)}`} className="btn-ghost mt-3 inline-block px-4 py-2 text-sm">
                {x.searchOn}
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
