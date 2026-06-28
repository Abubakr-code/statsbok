import { useState } from 'react';
import { useI18n } from '../../i18n';
import { useLibraryStore } from '../../store/libraryStore';
import { useToastStore } from '../../store/toastStore';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';

const SHELVES = [
  { id: 'want', uz: "O'qiyman", en: 'Want to Read', ru: 'Хочу читать' },
  { id: 'reading', uz: "O'qilmoqda", en: 'Reading', ru: 'Читаю' },
  { id: 'finished', uz: "O'qilgan", en: 'Finished', ru: 'Прочитано' },
];

function ISBNSearch({ onSelect, lang }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  async function doSearch() {
    if (!q.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      // Check if it looks like an ISBN (digits only)
      const isISBN = /^[\d\-]{9,}$/.test(q.trim());
      if (isISBN) {
        const { data } = await api.get(`/library/isbn/${q.trim()}`);
        setResults([data]);
      } else {
        const { data } = await api.get('/library/lookup', { params: { q: q.trim() } });
        setResults(data.results || []);
      }
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="flex gap-2 mb-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && doSearch()}
          placeholder="ISBN yoki kitob nomi..."
          className="flex-1 rounded-lg border border-ink-600 bg-ink-800 px-3 py-2.5 text-sm text-parchment placeholder-parchment-faint outline-none focus:border-amber"
        />
        <button onClick={doSearch} disabled={loading} className="btn-ghost px-4 py-2 text-sm">
          {loading ? '...' : 'Qidirish'}
        </button>
      </div>
      {searched && !loading && results.length === 0 && (
        <p className="text-sm text-parchment-faint text-center py-2">Topilmadi</p>
      )}
      {results.length > 0 && (
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {results.map((r, i) => (
            <button key={i} onClick={() => onSelect(r)}
              className="flex items-center gap-3 w-full rounded-lg border border-ink-600 p-2.5 text-left hover:border-amber/50 hover:bg-ink-700 transition-colors">
              {r.coverUrl && <img src={r.coverUrl} alt="" className="w-8 h-12 object-cover rounded flex-shrink-0" />}
              <div className="min-w-0">
                <p className="text-sm text-parchment font-medium line-clamp-1">{r.title}</p>
                <p className="text-xs text-parchment-faint line-clamp-1">{r.author} {r.year ? `· ${r.year}` : ''}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AddBookModal({ onClose, onAdded }) {
  const { t, lang } = useI18n((s) => ({ t: s.t, lang: s.lang }));
  const { isPremium } = useAuth();
  const addBook = useLibraryStore((s) => s.addBook);
  const showToast = useToastStore((s) => s.show);
  const [tab, setTab] = useState('search'); // 'search' | 'manual'
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: '', author: '', year: '', isbn: '', coverUrl: '', genre: '',
    language: 'uz', totalPages: '', description: '', shelf: 'want',
    startedAt: '', finishedAt: '', rating: ''
  });

  function setField(key, val) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  function handleSearchSelect(book) {
    setForm((f) => ({
      ...f,
      title: book.title || '',
      author: book.author || '',
      year: book.year ? String(book.year) : '',
      isbn: book.isbn || '',
      coverUrl: book.coverUrl || '',
      totalPages: book.totalPages ? String(book.totalPages) : '',
      description: book.description || ''
    }));
    setTab('manual');
  }

  async function handleSave() {
    if (!form.title.trim() || !form.author.trim()) {
      showToast('Kitob nomi va muallif kerak', 'error'); return;
    }
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        author: form.author.trim(),
        year: form.year ? parseInt(form.year) : undefined,
        isbn: form.isbn || undefined,
        coverUrl: form.coverUrl || undefined,
        genre: form.genre || undefined,
        language: form.language,
        totalPages: form.totalPages ? parseInt(form.totalPages) : undefined,
        description: form.description || undefined,
        shelf: form.shelf,
        startedAt: form.startedAt || undefined,
        finishedAt: form.finishedAt || undefined,
        rating: form.rating ? parseInt(form.rating) : undefined
      };
      await addBook(payload);
      showToast(t('library.bookAdded'), 'success');
      onAdded();
    } catch (err) {
      if (err.response?.data?.error === 'free_limit_reached') {
        showToast(t('library.freeLimit'), 'error');
      } else {
        showToast(t('toast.error'), 'error');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg rounded-2xl border border-ink-600 bg-ink-900 shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-ink-600">
          <h2 className="text-lg font-display text-parchment">{t('library.addBook')}</h2>
          <button onClick={onClose} className="text-parchment-faint hover:text-parchment transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-3 border-b border-ink-600">
          <button onClick={() => setTab('search')} className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${tab === 'search' ? 'bg-amber text-ink' : 'text-parchment-dim hover:text-parchment'}`}>
            🔍 ISBN / Qidiruv
          </button>
          <button onClick={() => setTab('manual')} className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${tab === 'manual' ? 'bg-amber text-ink' : 'text-parchment-dim hover:text-parchment'}`}>
            ✏️ Qo'lda kiritish
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5">
          {tab === 'search' && (
            <ISBNSearch onSelect={handleSearchSelect} lang={lang} />
          )}

          {tab === 'manual' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs text-parchment-faint mb-1 block">Kitob nomi *</label>
                  <input value={form.title} onChange={(e) => setField('title', e.target.value)}
                    className="w-full rounded-lg border border-ink-600 bg-ink-800 px-3 py-2 text-sm text-parchment outline-none focus:border-amber" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-parchment-faint mb-1 block">Muallif *</label>
                  <input value={form.author} onChange={(e) => setField('author', e.target.value)}
                    className="w-full rounded-lg border border-ink-600 bg-ink-800 px-3 py-2 text-sm text-parchment outline-none focus:border-amber" />
                </div>
                <div>
                  <label className="text-xs text-parchment-faint mb-1 block">Yil</label>
                  <input type="number" value={form.year} onChange={(e) => setField('year', e.target.value)}
                    className="w-full rounded-lg border border-ink-600 bg-ink-800 px-3 py-2 text-sm text-parchment outline-none focus:border-amber" />
                </div>
                <div>
                  <label className="text-xs text-parchment-faint mb-1 block">Sahifalar soni</label>
                  <input type="number" value={form.totalPages} onChange={(e) => setField('totalPages', e.target.value)}
                    className="w-full rounded-lg border border-ink-600 bg-ink-800 px-3 py-2 text-sm text-parchment outline-none focus:border-amber" />
                </div>
                <div>
                  <label className="text-xs text-parchment-faint mb-1 block">Janr</label>
                  <input value={form.genre} onChange={(e) => setField('genre', e.target.value)}
                    className="w-full rounded-lg border border-ink-600 bg-ink-800 px-3 py-2 text-sm text-parchment outline-none focus:border-amber" />
                </div>
                <div>
                  <label className="text-xs text-parchment-faint mb-1 block">Muqova URL</label>
                  <input value={form.coverUrl} onChange={(e) => setField('coverUrl', e.target.value)}
                    className="w-full rounded-lg border border-ink-600 bg-ink-800 px-3 py-2 text-sm text-parchment outline-none focus:border-amber" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-parchment-faint mb-1 block">Javon</label>
                  <div className="flex gap-2">
                    {SHELVES.map((s) => (
                      <button key={s.id} onClick={() => setField('shelf', s.id)}
                        className={`flex-1 rounded-lg py-2 text-xs font-medium transition-colors ${form.shelf === s.id ? 'bg-amber text-ink' : 'border border-ink-600 text-parchment-dim hover:text-parchment'}`}>
                        {s[lang] || s.en}
                      </button>
                    ))}
                  </div>
                </div>
                {form.shelf === 'finished' && (
                  <div className="col-span-2">
                    <label className="text-xs text-parchment-faint mb-1 block">Baho (1-5)</label>
                    <div className="flex gap-2">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button key={n} onClick={() => setField('rating', String(n))}
                          className={`w-10 h-10 rounded-lg text-lg transition-colors ${form.rating === String(n) ? 'bg-amber text-ink' : 'border border-ink-600 text-parchment-faint hover:text-amber'}`}>
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {tab === 'manual' && (
          <div className="p-5 border-t border-ink-600 flex gap-3">
            <button onClick={onClose} className="btn-ghost flex-1 py-2.5">Bekor qilish</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 py-2.5">
              {saving ? '...' : t('library.addBook')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
