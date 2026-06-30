import { useState, useEffect } from 'react';

const T = {
  uz: { open: 'Ochish uchun bosing', close: 'Yopish', loading: 'Yuklanmoqda...' },
  ru: { open: 'Нажмите, чтобы открыть', close: 'Закрыть', loading: 'Загрузка...' },
  en: { open: 'Tap to open', close: 'Close', loading: 'Loading...' }
};

/**
 * Full-screen reader that opens a library PDF with a real book-opening
 * animation: the cover swings open (3D rotateY) revealing the pages (the PDF
 * rendered in an iframe). Robust across browsers — no PDF.js parsing needed.
 */
export default function BookReader({ book, lang = 'uz', onClose }) {
  const [opened, setOpened] = useState(false);
  const tx = T[lang] || T.uz;
  const pdfUrl = `/api/library/${book._id}/pdf`;

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-3 sm:p-6 animate-fade-in"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        aria-label={tx.close}
        className="absolute right-4 top-4 z-[70] flex h-10 w-10 items-center justify-center rounded-full bg-ink-800/90 text-parchment shadow-lg hover:bg-ink-700"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 6l12 12M18 6L6 18" /></svg>
      </button>

      <div
        className="relative h-[90vh] w-full max-w-[940px]"
        style={{ perspective: '2200px' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Pages = the actual PDF */}
        <div className="absolute inset-0 overflow-hidden rounded-l-md rounded-r-xl bg-ink-900 shadow-2xl">
          <div className="absolute inset-0 flex items-center justify-center text-parchment-faint">
            {tx.loading}
          </div>
          <iframe
            title={book.title}
            src={pdfUrl}
            className="relative h-full w-full border-0 bg-white"
          />
        </div>

        {/* Cover that swings open */}
        <button
          onClick={() => setOpened(true)}
          className="absolute inset-0 origin-left overflow-hidden rounded-l-md rounded-r-xl"
          style={{
            transformStyle: 'preserve-3d',
            transition: 'transform 1.1s ease-in-out, opacity 0.5s ease 0.75s',
            transform: opened ? 'rotateY(-172deg)' : 'rotateY(0deg)',
            opacity: opened ? 0 : 1,
            pointerEvents: opened ? 'none' : 'auto',
            boxShadow: '10px 0 30px rgba(0,0,0,0.5)'
          }}
        >
          {book.coverUrl ? (
            <img src={book.coverUrl} alt={book.title} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-[#3a2a1a] to-[#1a1109] p-6 text-center">
              <h2 className="font-display text-2xl text-parchment">{book.title}</h2>
              {book.author && <p className="mt-2 text-parchment-dim">{book.author}</p>}
            </div>
          )}
          {/* Spine + hint overlay */}
          <div className="pointer-events-none absolute inset-y-0 left-0 w-4 bg-gradient-to-r from-black/50 to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center bg-gradient-to-t from-black/70 to-transparent p-4">
            <span className="rounded-full bg-amber/90 px-4 py-1.5 text-sm font-medium text-ink">{tx.open}</span>
          </div>
        </button>
      </div>
    </div>
  );
}
