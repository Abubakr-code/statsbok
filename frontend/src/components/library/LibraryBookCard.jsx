import { useState } from 'react';
import { Link } from 'react-router-dom';

function StarRating({ value }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} width="10" height="10" viewBox="0 0 24 24"
          fill={i <= (value || 0) ? 'currentColor' : 'none'}
          stroke="currentColor" strokeWidth="1.5" className="text-amber">
          <path d="M12 2l2.9 6.3L22 9.2l-5 4.9 1.2 6.9L12 17.8 5.8 21l1.2-6.9-5-4.9 7.1-.9z" />
        </svg>
      ))}
    </div>
  );
}

export default function LibraryBookCard({ book, onShelfChange, onDelete, isPremium, shelves, lang }) {
  const [imgError, setImgError] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const progress = book.totalPages && book.currentPage
    ? Math.round((book.currentPage / book.totalPages) * 100)
    : null;

  return (
    <div className="card p-0 overflow-hidden group relative">
      {/* Cover */}
      <Link to={`/library/${book._id}`} className="block">
        <div className="aspect-[2/3] relative overflow-hidden bg-ink-800">
          {book.coverUrl && !imgError ? (
            <img src={book.coverUrl} alt={book.title} loading="lazy"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              onError={() => setImgError(true)} />
          ) : (
            <div className="h-full w-full flex flex-col items-center justify-center bg-gradient-to-br from-ink-700 to-ink-900 p-3">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-parchment-faint mb-2">
                <path d="M4 5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v16l-6-3-6 3z" />
              </svg>
              <span className="text-[11px] text-parchment-faint text-center line-clamp-3">{book.title}</span>
            </div>
          )}
          {/* Progress overlay for "reading" */}
          {book.shelf === 'reading' && progress !== null && (
            <div className="absolute bottom-0 left-0 right-0 bg-ink/80 px-2 py-1">
              <div className="flex items-center justify-between text-[10px] text-parchment-faint mb-0.5">
                <span>{book.currentPage}/{book.totalPages}</span>
                <span>{progress}%</span>
              </div>
              <div className="h-1 rounded-full bg-ink-600">
                <div className="h-full rounded-full bg-amber transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}
        </div>
      </Link>

      {/* Info */}
      <div className="p-2.5">
        <Link to={`/library/${book._id}`} className="hover:text-amber transition-colors">
          <p className="text-sm font-medium text-parchment line-clamp-1">{book.title}</p>
          <p className="text-xs text-parchment-faint line-clamp-1">{book.author}</p>
        </Link>
        {book.rating && <div className="mt-1"><StarRating value={book.rating} /></div>}
      </div>

      {/* Menu button */}
      <div className="absolute top-2 right-2">
        <button
          onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
          className="flex h-7 w-7 items-center justify-center rounded-full bg-ink/70 text-parchment-dim opacity-0 group-hover:opacity-100 transition-opacity hover:text-parchment"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>
          </svg>
        </button>
        {showMenu && (
          <div className="absolute right-0 top-8 z-20 min-w-[160px] rounded-xl border border-ink-600 bg-ink-800 shadow-xl py-1 text-sm"
            onMouseLeave={() => setShowMenu(false)}>
            {shelves.filter(s => s.id !== 'all' && s.id !== book.shelf).map(s => (
              (!s.premium || isPremium) && (
                <button key={s.id}
                  onClick={() => { onShelfChange(book._id, s.id); setShowMenu(false); }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-parchment-dim hover:bg-ink-700 hover:text-parchment">
                  {s.emoji} {s[lang] || s.en}
                </button>
              )
            ))}
            <div className="my-1 border-t border-ink-600" />
            <button
              onClick={() => { onDelete(book._id); setShowMenu(false); }}
              className="flex w-full items-center gap-2 px-3 py-2 text-red-400 hover:bg-red-900/20">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 6h18M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2" />
              </svg>
              O'chirish
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
