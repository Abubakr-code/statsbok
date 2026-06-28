import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import { useI18n } from '../i18n';
import { useSavedQuotes } from '../hooks/useSavedQuotes';
import { useAuth } from '../hooks/useAuth';
import QuoteCard from '../components/QuoteCard';
import BookPreviewModal from '../components/BookPreviewModal';

function bookFrom(quote) {
  const b = quote.bookId;
  if (!b || typeof b !== 'object') return null;
  return {
    id: b._id,
    title: b.title,
    titleUz: b.titleUz,
    author: b.author,
    year: b.year,
    coverImage: b.coverImage,
    affiliateLink: b.affiliateLink
  };
}

// Small modal for assigning a folder + tags to a saved quote (premium).
function OrganizeModal({ initial, onSave, onClose, t }) {
  const [folder, setFolder] = useState(initial?.folder || '');
  const [tags, setTags] = useState((initial?.tags || []).join(', '));
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    const tagList = tags.split(',').map((x) => x.trim()).filter(Boolean);
    await onSave(folder.trim(), tagList);
    setBusy(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="w-full max-w-sm space-y-4 rounded-2xl border border-ink-600 bg-ink-800 p-6"
      >
        <h3 className="font-display text-lg text-parchment">{t('archive.organize')}</h3>
        <div>
          <label className="mb-1 block text-sm text-parchment-dim">{t('archive.folder')}</label>
          <input value={folder} onChange={(e) => setFolder(e.target.value)} className="input" placeholder={t('archive.folder.ph')} />
        </div>
        <div>
          <label className="mb-1 block text-sm text-parchment-dim">{t('archive.tags')}</label>
          <input value={tags} onChange={(e) => setTags(e.target.value)} className="input" placeholder={t('archive.tags.ph')} />
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="btn-ghost flex-1">
            {t('preview.close')}
          </button>
          <button type="submit" disabled={busy} className="btn-primary flex-1">
            {busy ? t('common.loading') : t('profile.save')}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function Archive() {
  const t = useI18n((s) => s.t);
  const { isPremium } = useAuth();
  const { saved, savedMeta, savedLimit, loading, load, toggle, setQuoteMeta } = useSavedQuotes();
  const [preview, setPreview] = useState(null);
  const [organizeId, setOrganizeId] = useState(null);
  const [bookFilter, setBookFilter] = useState('all');
  const [langFilter, setLangFilter] = useState('all');
  const [folderFilter, setFolderFilter] = useState('all');

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const books = useMemo(() => {
    const map = new Map();
    for (const q of saved) {
      const b = q.bookId;
      if (b && typeof b === 'object' && !map.has(String(b._id))) {
        map.set(String(b._id), b.title);
      }
    }
    return [...map.entries()];
  }, [saved]);

  const folders = useMemo(() => {
    const set = new Set();
    Object.values(savedMeta || {}).forEach((m) => m.folder && set.add(m.folder));
    return [...set];
  }, [savedMeta]);

  const filtered = saved.filter((q) => {
    if (bookFilter !== 'all' && String(q.bookId?._id) !== bookFilter) return false;
    if (langFilter !== 'all' && q.language !== langFilter) return false;
    if (folderFilter !== 'all' && savedMeta?.[String(q._id)]?.folder !== folderFilter) return false;
    return true;
  });

  async function handleDelete(quoteId) {
    await toggle(quoteId);
  }

  function exportText() {
    const lines = filtered.map((q) => {
      const b = q.bookId;
      const src = b && typeof b === 'object' ? ` — ${b.title}${b.author ? ', ' + b.author : ''}` : '';
      return `"${q.text}"${src}`;
    });
    const blob = new Blob([lines.join('\n\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'statbooks-archive.txt';
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportPdf() {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const margin = 48;
    const width = doc.internal.pageSize.getWidth() - margin * 2;
    let y = margin;
    doc.setFontSize(18);
    doc.text('StatBooks — Archive', margin, y);
    y += 28;
    doc.setFontSize(11);
    filtered.forEach((q) => {
      const b = q.bookId;
      const src = b && typeof b === 'object' ? `${b.title}${b.author ? ', ' + b.author : ''}` : '';
      const block = doc.splitTextToSize(`"${q.text}"`, width);
      block.forEach((line) => {
        if (y > doc.internal.pageSize.getHeight() - margin) {
          doc.addPage();
          y = margin;
        }
        doc.text(line, margin, y);
        y += 16;
      });
      if (src) {
        doc.setTextColor(150);
        doc.text(`— ${src}`, margin, y);
        doc.setTextColor(0);
        y += 22;
      } else {
        y += 8;
      }
    });
    doc.save('statbooks-archive.pdf');
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <section className="mb-6 overflow-hidden rounded-2xl border border-ink-600 bg-gradient-to-br from-ink-800 to-ink-900">
        <div className="flex flex-wrap items-center justify-between gap-3 p-5 sm:p-6">
          <div>
            <h1 className="text-2xl text-parchment sm:text-3xl">{t('archive.title')}</h1>
            <p className="mt-1 text-sm text-parchment-dim">
              {filtered.length}/{saved.length} ta stata ko'rsatilmoqda
            </p>
          </div>
          {isPremium && saved.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <button onClick={exportText} className="btn-ghost px-3 py-2 text-sm">
                {t('archive.export.txt')}
              </button>
              <button onClick={exportPdf} className="btn-primary px-3 py-2 text-sm">
                {t('archive.export.pdf')}
              </button>
            </div>
          )}
        </div>
      </section>

      {saved.length > 0 && (
        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          <div className="card">
            <p className="text-xs text-parchment-faint">Jami saqlangan</p>
            <p className="mt-1 text-2xl font-display text-amber">{saved.length}</p>
          </div>
          <div className="card">
            <p className="text-xs text-parchment-faint">Filtrlangan natija</p>
            <p className="mt-1 text-2xl font-display text-amber">{filtered.length}</p>
          </div>
          <div className="card">
            <p className="text-xs text-parchment-faint">Papkalar</p>
            <p className="mt-1 text-2xl font-display text-amber">{folders.length}</p>
          </div>
        </div>
      )}

      {!isPremium && savedLimit != null && (
        <div className="card mb-6">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="text-parchment-dim">
              {t('archive.limit', { used: saved.length, limit: savedLimit })}
            </span>
            <Link to="/premium" className="text-amber hover:underline">
              {t('nav.premium')}
            </Link>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-ink-700">
            <div
              className="h-full rounded-full bg-amber transition-all"
              style={{ width: `${Math.min(100, (saved.length / savedLimit) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {saved.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-3">
          <select value={bookFilter} onChange={(e) => setBookFilter(e.target.value)} className="input max-w-xs py-2">
            <option value="all">{t('archive.filter.all')}</option>
            {books.map(([id, title]) => (
              <option key={id} value={id}>
                {title}
              </option>
            ))}
          </select>
          <select value={langFilter} onChange={(e) => setLangFilter(e.target.value)} className="input max-w-[140px] py-2">
            <option value="all">{t('archive.filter.all')}</option>
            <option value="uz">UZ</option>
            <option value="en">EN</option>
            <option value="ru">RU</option>
          </select>
          {isPremium && folders.length > 0 && (
            <select value={folderFilter} onChange={(e) => setFolderFilter(e.target.value)} className="input max-w-[180px] py-2">
              <option value="all">{t('archive.allFolders')}</option>
              {folders.map((f) => (
                <option key={f} value={f}>
                  📁 {f}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {loading && <p className="text-parchment-dim">{t('common.loading')}</p>}

      {!loading && saved.length === 0 && (
        <p className="py-12 text-center text-parchment-dim">{t('archive.empty')}</p>
      )}

      {!loading && filtered.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {filtered.map((q) => (
            <QuoteCard
              key={q._id}
              quoteId={q._id}
              text={q.text}
              pageNumber={q.pageNumber}
              query={null}
              book={bookFrom(q)}
              variant="archive"
              savedDate={q.createdAt}
              meta={savedMeta?.[String(q._id)]}
              onOrganize={isPremium ? setOrganizeId : undefined}
              onPreview={(book) => setPreview({ book, highlightText: q.text, quoteId: q._id })}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {preview && (
        <BookPreviewModal
          book={preview.book}
          highlightText={preview.highlightText}
          quoteId={preview.quoteId}
          onClose={() => setPreview(null)}
        />
      )}

      {organizeId && (
        <OrganizeModal
          t={t}
          initial={savedMeta?.[String(organizeId)]}
          onSave={(folder, tags) => setQuoteMeta(organizeId, folder, tags)}
          onClose={() => setOrganizeId(null)}
        />
      )}
    </div>
  );
}
