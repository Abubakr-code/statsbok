import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useI18n } from '../../i18n';
import { useAuth } from '../../hooks/useAuth';
import { useLibraryStore } from '../../store/libraryStore';
import { useToastStore } from '../../store/toastStore';
import SEO from '../../components/SEO';
import AddBookModal from '../../components/library/AddBookModal';
import LibraryBookCard from '../../components/library/LibraryBookCard';
import BookshelfView from '../../components/library/BookshelfView';
import GoalRing from '../../components/library/GoalRing';

const SHELVES = [
  { id: 'all',      emoji: '📚', uz: 'Hammasi',         en: 'All',           ru: 'Все' },
  { id: 'reading',  emoji: '📖', uz: "O'qilmoqda",      en: 'Reading',       ru: 'Читаю' },
  { id: 'finished', emoji: '✅', uz: "O'qilgan",         en: 'Finished',      ru: 'Прочитано' },
  { id: 'want',     emoji: '📋', uz: "O'qiyman",         en: 'Want to Read',  ru: 'Хочу читать' },
  { id: 'wishlist', emoji: '💝', uz: 'Orzu',             en: 'Wishlist',      ru: 'Мечта', premium: true },
  { id: 'dropped',  emoji: '🚫', uz: 'Yarimida qoldim', en: 'Dropped',       ru: 'Бросил', premium: true },
];

function ShelfTab({ shelf, active, onClick, isPremium, lang }) {
  const label = shelf[lang] || shelf.en;
  const locked = shelf.premium && !isPremium;
  return (
    <button
      onClick={() => !locked && onClick(shelf.id)}
      className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors
        ${active ? 'bg-amber text-ink' : 'text-parchment-dim hover:text-parchment'}
        ${locked ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
      `}
      title={locked ? 'Premium required' : ''}
    >
      {shelf.emoji} {label}
      {locked && <span className="text-[10px] text-amber">★</span>}
    </button>
  );
}

export default function LibraryPage() {
  const { t, lang } = useI18n((s) => ({ t: s.t, lang: s.lang }));
  const { isAuthenticated, isPremium } = useAuth();
  const navigate = useNavigate();
  const { books, loading, activeShelf, stats, goal, setShelf, fetchBooks, fetchStats, fetchGoal, deleteBook, changeShelf } = useLibraryStore();
  const showToast = useToastStore((s) => s.show);
  const [addOpen, setAddOpen] = useState(false);
  // 'grid' = manage cards, 'shelf' = 3D bookshelf view. Persisted per browser.
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('libraryView') || 'grid');
  function changeView(mode) {
    setViewMode(mode);
    localStorage.setItem('libraryView', mode);
  }

  useEffect(() => {
    if (!isAuthenticated) { navigate('/login'); return; }
    const params = activeShelf !== 'all' ? { shelf: activeShelf } : {};
    fetchBooks(params);
    fetchStats();
    fetchGoal();
  }, [isAuthenticated, activeShelf]);

  async function handleShelfChange(bookId, shelf) {
    try {
      await changeShelf(bookId, shelf);
      showToast(t('library.shelfChanged'), 'success');
    } catch (err) {
      if (err.response?.data?.error === 'premium_required') {
        showToast('Bu javon faqat Premium uchun', 'error');
      } else {
        showToast(t('toast.error'), 'error');
      }
    }
  }

  async function handleDelete(bookId) {
    if (!confirm(t('library.confirmDelete'))) return;
    try {
      await deleteBook(bookId);
      showToast(t('library.deleted'), 'success');
    } catch {
      showToast(t('toast.error'), 'error');
    }
  }

  const currentYear = new Date().getFullYear();
  const goalData = goal?.goal;
  const actualFinished = goal?.actualFinished || 0;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <SEO title={t('library.title')} description={t('library.seoDesc')} />

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-display text-parchment">{t('library.title')}</h1>
          {stats && (
            <p className="text-sm text-parchment-faint mt-1">
              {stats.totalBooks} {t('library.stats.totalBooks')} · {stats.finishedBooks} {t('library.stats.finished')} · {Math.round((stats.totalMinutes || 0) / 60)} {t('library.stats.totalHours')}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Link to="/library/goal" className="btn-ghost px-3 py-2 text-sm">
            🎯 {t('library.goal.title')}
          </Link>
          <button onClick={() => setAddOpen(true)} className="btn-primary px-4 py-2 text-sm flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
            {t('library.addBook')}
          </button>
        </div>
      </div>

      {/* Stats + Goal row */}
      {stats && (
        <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="card py-4 text-center">
            <p className="text-2xl font-display text-amber">{stats.totalBooks}</p>
            <p className="text-xs text-parchment-faint mt-1">{t('library.stats.totalBooks')}</p>
          </div>
          <div className="card py-4 text-center">
            <p className="text-2xl font-display text-amber">{stats.finishedBooks}</p>
            <p className="text-xs text-parchment-faint mt-1">{t('library.stats.finished')}</p>
          </div>
          <div className="card py-4 text-center">
            <p className="text-2xl font-display text-amber">{stats.currentStreak}</p>
            <p className="text-xs text-parchment-faint mt-1">{t('library.stats.streak')}</p>
          </div>
          <div className="card py-4 flex flex-col items-center justify-center gap-1">
            {goalData ? (
              <>
                <GoalRing current={actualFinished} target={goalData.targetBooks} size={56} />
                <p className="text-xs text-parchment-faint">{currentYear} {t('library.goal.title')}</p>
              </>
            ) : (
              <Link to="/library/goal" className="text-sm text-amber hover:underline">{t('library.goal.set')}</Link>
            )}
          </div>
        </div>
      )}

      {/* Shelf tabs + view toggle */}
      <div className="mb-6 flex items-center gap-2">
        <div className="flex flex-1 gap-1 overflow-x-auto pb-1">
          {SHELVES.map((shelf) => (
            <ShelfTab
              key={shelf.id}
              shelf={shelf}
              active={activeShelf === shelf.id}
              onClick={setShelf}
              isPremium={isPremium}
              lang={lang}
            />
          ))}
        </div>
        <div className="flex shrink-0 items-center gap-1 rounded-lg bg-ink-800 p-1">
          <button
            onClick={() => changeView('grid')}
            title="Grid"
            className={`rounded-md p-1.5 transition-colors ${viewMode === 'grid' ? 'bg-amber text-ink' : 'text-parchment-faint hover:text-parchment'}`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
          </button>
          <button
            onClick={() => changeView('shelf')}
            title="Bookshelf"
            className={`rounded-md p-1.5 transition-colors ${viewMode === 'shelf' ? 'bg-amber text-ink' : 'text-parchment-faint hover:text-parchment'}`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19V5M8 19V7M12 19V6M16 19V8M20 19V5M3 19h18"/></svg>
          </button>
        </div>
      </div>

      {/* Books grid */}
      {loading && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="card p-0 overflow-hidden">
              <div className="skeleton aspect-[2/3] w-full" />
              <div className="p-3 space-y-2">
                <div className="skeleton h-3 w-3/4" />
                <div className="skeleton h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && books.length === 0 && (
        <div className="py-20 text-center">
          <div className="text-5xl mb-4">📚</div>
          <p className="text-parchment-dim mb-4">{t('library.empty')}</p>
          <button onClick={() => setAddOpen(true)} className="btn-primary px-6 py-2.5">
            {t('library.addBook')}
          </button>
        </div>
      )}

      {!loading && books.length > 0 && viewMode === 'shelf' && (
        <BookshelfView books={books} />
      )}

      {!loading && books.length > 0 && viewMode === 'grid' && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {books.map((book) => (
            <LibraryBookCard
              key={book._id}
              book={book}
              onShelfChange={handleShelfChange}
              onDelete={handleDelete}
              isPremium={isPremium}
              shelves={SHELVES}
              lang={lang}
            />
          ))}
        </div>
      )}

      {addOpen && <AddBookModal onClose={() => setAddOpen(false)} onAdded={() => { setAddOpen(false); fetchBooks(activeShelf !== 'all' ? { shelf: activeShelf } : {}); }} />}
    </div>
  );
}
