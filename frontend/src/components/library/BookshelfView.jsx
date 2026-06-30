import { Link } from 'react-router-dom';

// Split the books into rows so each one sits on its own wooden shelf plank.
function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function ShelfBook({ book }) {
  const progress = book.totalPages && book.currentPage
    ? Math.round((book.currentPage / book.totalPages) * 100)
    : null;

  return (
    <Link
      to={`/library/${book._id}`}
      title={`${book.title}${book.author ? ` — ${book.author}` : ''}`}
      className="group/book relative shrink-0"
      style={{ transformStyle: 'preserve-3d' }}
    >
      <div
        className="relative h-[150px] w-[100px] origin-bottom overflow-hidden rounded-l-[3px] rounded-r-md
          shadow-[7px_10px_18px_rgba(0,0,0,0.55)] transition-transform duration-300 ease-out
          [transform:rotateY(-24deg)] group-hover/book:[transform:rotateY(-4deg)_translateY(-14px)_scale(1.04)]"
      >
        {/* Cover */}
        {book.coverUrl ? (
          <img
            src={book.coverUrl}
            alt={book.title}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-ink-700 to-ink-900 p-2 text-center">
            <span className="line-clamp-4 text-[10px] leading-tight text-parchment-faint">{book.title}</span>
          </div>
        )}

        {/* Spine shadow on the left edge for depth */}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-3 bg-gradient-to-r from-black/55 to-transparent" />
        {/* Page block on the right edge */}
        <div className="pointer-events-none absolute inset-y-[3px] right-0 w-[3px] bg-gradient-to-b from-parchment/70 via-parchment/40 to-parchment/70" />
        {/* Glossy highlight */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-white/15" />

        {/* Reading progress */}
        {book.shelf === 'reading' && progress !== null && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-ink/60">
            <div className="h-full bg-amber" style={{ width: `${progress}%` }} />
          </div>
        )}
      </div>
    </Link>
  );
}

export default function BookshelfView({ books }) {
  const shelves = chunk(books, 7);

  return (
    <div className="space-y-1.5 overflow-hidden rounded-xl bg-gradient-to-b from-[#2a1d12] to-[#1a1109] p-4 sm:p-6"
      style={{ perspective: '1600px' }}>
      {shelves.map((row, ri) => (
        <div key={ri} className="relative">
          {/* Standing books */}
          <div
            className="flex items-end gap-4 overflow-x-auto px-2 pb-1 pt-8"
            style={{ transformStyle: 'preserve-3d' }}
          >
            {row.map((book) => <ShelfBook key={book._id} book={book} />)}
          </div>
          {/* Wooden plank */}
          <div className="h-4 rounded-sm bg-gradient-to-b from-[#7a5532] via-[#5c3e22] to-[#3d2817] shadow-[0_7px_12px_rgba(0,0,0,0.55)]" />
          <div className="mb-3 h-2 rounded-b-md bg-[#241509]" />
        </div>
      ))}
    </div>
  );
}
