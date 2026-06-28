import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';
import { useI18n } from '../i18n';

// ─── Tiny bar chart (no external dep) ────────────────────────────────────────
function MiniBarChart({ data = [] }) {
  const max = Math.max(...data.map((d) => d.saves), 1);
  return (
    <div className="mt-2">
      <div className="flex items-end gap-px h-20">
        {data.map((d, i) => (
          <div
            key={i}
            title={`${d.date}: ${d.saves} ta saqlash`}
            style={{ height: `${Math.max((d.saves / max) * 100, 2)}%` }}
            className="flex-1 rounded-t bg-amber opacity-60 hover:opacity-100 transition-opacity"
          />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-parchment-faint">
        <span>{data[0]?.date?.slice(5)}</span>
        <span>Bugun</span>
      </div>
    </div>
  );
}

// ─── Metric card ──────────────────────────────────────────────────────────────
function MetricCard({ label, value, icon, color = 'text-amber' }) {
  return (
    <div className="card flex items-start gap-3">
      <span className="text-2xl">{icon}</span>
      <div>
        <p className="text-xs text-parchment-dim">{label}</p>
        <p className={`mt-0.5 text-3xl font-display ${color}`}>{value ?? '—'}</p>
      </div>
    </div>
  );
}

// ─── Stats section ────────────────────────────────────────────────────────────
function StatsSection() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/blogger/stats')
      .then((r) => setStats(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-parchment-dim py-10 text-center">Yuklanmoqda…</p>;

  return (
    <div>
      <h2 className="mb-5 text-2xl text-parchment">Statistika</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <MetricCard icon="🖱️" label="Widget bosilishi" value={stats?.widgetClicks ?? 0} />
        <MetricCard icon="📂" label="To'plam ko'rishlar" value={stats?.totalCollectionViews ?? 0} />
        <MetricCard icon="📌" label="Bu hafta saqlangan" value={stats?.weekSaves ?? 0} />
        <MetricCard icon="📚" label="Jami saqlangan" value={stats?.totalSaved ?? 0} color="text-parchment" />
      </div>
      <div className="card">
        <h3 className="text-parchment mb-1">So'nggi 30 kun — saqlash faoliyati</h3>
        <p className="text-xs text-parchment-faint mb-3">
          Platformadagi o'z hisobingizda saqlangan statalar dinamikasi
        </p>
        <MiniBarChart data={stats?.savesChart || []} />
      </div>
      {stats?.collections?.length > 0 && (
        <div className="mt-6 card">
          <h3 className="text-parchment mb-3">To'plamlar holati</h3>
          <div className="space-y-2">
            {stats.collections.map((c) => (
              <div key={c._id} className="flex items-center justify-between">
                <span className="text-sm text-parchment">{c.title}</span>
                <span className="text-xs text-amber">{c.views} ko'rish</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Books section ────────────────────────────────────────────────────────────
function BooksSection() {
  const lang = useI18n((s) => s.lang);
  const [books, setBooks] = useState([]);
  const [bestSellers, setBestSellers] = useState([]);

  useEffect(() => {
    api.get(`/books/trending?lang=${lang}`).then((r) => setBooks(r.data.books || [])).catch(() => {});
    api.get('/books/best-sellers').then((r) => setBestSellers(r.data.books || [])).catch(() => {});
  }, [lang]);

  const BookRow = ({ book, right }) => (
    <div className="flex items-center gap-3">
      {book.coverImage
        ? <img src={book.coverImage} alt={book.title} className="h-14 w-10 flex-shrink-0 rounded object-cover" />
        : <div className="h-14 w-10 flex-shrink-0 rounded bg-ink-700" />}
      <div className="min-w-0">
        <p className="line-clamp-1 text-sm text-parchment">{book.titleUz || book.title}</p>
        <p className="text-xs text-parchment-faint">{book.author}</p>
      </div>
      <span className="ml-auto shrink-0 text-xs text-amber">{right}</span>
    </div>
  );

  return (
    <div>
      <h2 className="mb-5 text-2xl text-parchment">Kitoblar</h2>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card">
          <h3 className="mb-4 text-lg text-parchment">Auditoriyada mashhur kitoblar</h3>
          <div className="space-y-3">
            {books.slice(0, 10).map((b) => (
              <BookRow key={b._id} book={b} right={`${b.likes || 0} yoqtirish`} />
            ))}
          </div>
        </section>
        <section className="card">
          <h3 className="mb-4 text-lg text-parchment">Eng ko'p sotilganlar</h3>
          {bestSellers.length === 0
            ? <p className="text-sm text-parchment-dim">Hali pullik kitob buyurtmalari yo'q.</p>
            : <div className="space-y-3">
                {bestSellers.map((b) => (
                  <BookRow key={b._id} book={b} right={`${b.sold} sotildi`} />
                ))}
              </div>
          }
        </section>
      </div>
    </div>
  );
}

// ─── Collections section ──────────────────────────────────────────────────────
function CollectionsSection({ isPremium }) {
  const [collections, setCollections] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [creating, setCreating]       = useState(false);
  const [newForm, setNewForm]         = useState({ title: '', niche: '', isPublic: true });
  const [saving, setSaving]           = useState(false);
  const [expanded, setExpanded]       = useState(null);
  const [quoteSearch, setQuoteSearch] = useState('');
  const [quoteResults, setQuoteResults] = useState([]);
  const [searching, setSearching]     = useState(false);
  const [copiedSlug, setCopiedSlug]   = useState(null);
  const searchTimer = useRef(null);

  const frontendBase = window.location.origin;

  const load = useCallback(() => {
    setLoading(true);
    api.get('/blogger/collections')
      .then((r) => setCollections(r.data.collections || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const limit = isPremium ? Infinity : 3;
  const atLimit = collections.length >= limit;

  const createCollection = async () => {
    if (!newForm.title.trim()) return;
    setSaving(true);
    try {
      await api.post('/blogger/collections', newForm);
      setCreating(false);
      setNewForm({ title: '', niche: '', isPublic: true });
      load();
    } catch (e) {
      const msg = e?.response?.data?.error;
      if (msg === 'collection_limit') alert("To'plamlar limiti: 3 ta (premium uchun cheksiz)");
    } finally { setSaving(false); }
  };

  const deleteCollection = async (id) => {
    if (!confirm("Bu to'plamni o'chirishni tasdiqlaysizmi?")) return;
    await api.delete(`/blogger/collections/${id}`);
    setCollections((prev) => prev.filter((c) => c._id !== id));
  };

  const copyUrl = async (slug) => {
    const url = `${frontendBase}/collection/${slug}`;
    try { await navigator.clipboard.writeText(url); }
    catch { window.prompt('URL:', url); }
    setCopiedSlug(slug);
    setTimeout(() => setCopiedSlug(null), 2500);
  };

  const searchQuotes = (q) => {
    clearTimeout(searchTimer.current);
    setQuoteSearch(q);
    if (!q || q.length < 2) { setQuoteResults([]); return; }
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const r = await api.get(`/blogger/quotes/search?q=${encodeURIComponent(q)}`);
        setQuoteResults(r.data.quotes || []);
      } catch { setQuoteResults([]); }
      finally { setSearching(false); }
    }, 400);
  };

  const toggleQuote = async (col, quoteId) => {
    const has = (col.quotes || []).map(String).includes(String(quoteId));
    await api.post(`/blogger/collections/${col._id}/quotes`, {
      add: has ? [] : [quoteId],
      remove: has ? [quoteId] : []
    });
    setCollections((prev) =>
      prev.map((c) => {
        if (c._id !== col._id) return c;
        const quotes = has
          ? (c.quotes || []).filter((q) => String(q) !== String(quoteId))
          : [...(c.quotes || []), quoteId];
        return { ...c, quotes, quoteCount: quotes.length };
      })
    );
  };

  if (loading) return <p className="text-parchment-dim py-10 text-center">Yuklanmoqda…</p>;

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-2xl text-parchment">Stata to'plamlari</h2>
        {!atLimit && (
          <button onClick={() => setCreating(!creating)} className="btn-primary text-sm px-4 py-1.5">
            + Yangi to'plam
          </button>
        )}
      </div>

      {!isPremium && (
        <p className="mb-4 text-xs text-parchment-dim rounded-lg border border-ink-600 px-3 py-2">
          Bepul: {collections.length}/3 to'plam · Premium: cheksiz to'plam
        </p>
      )}

      {creating && (
        <div className="card mb-6 border border-amber/30">
          <h3 className="text-parchment mb-3">Yangi to'plam</h3>
          <div className="space-y-3">
            <input
              className="input w-full"
              placeholder="To'plam nomi (masalan: Motivatsion statalar)"
              value={newForm.title}
              onChange={(e) => setNewForm((p) => ({ ...p, title: e.target.value }))}
            />
            <input
              className="input w-full"
              placeholder="Yo'nalish (masalan: motivatsiya, sevgi, falsafa)"
              value={newForm.niche}
              onChange={(e) => setNewForm((p) => ({ ...p, niche: e.target.value }))}
            />
            <label className="flex items-center gap-2 text-sm text-parchment-dim">
              <input
                type="checkbox"
                checked={newForm.isPublic}
                onChange={(e) => setNewForm((p) => ({ ...p, isPublic: e.target.checked }))}
              />
              Ommaga ochiq
            </label>
            <div className="flex gap-2">
              <button onClick={createCollection} disabled={saving} className="btn-primary text-sm px-4 py-1.5">
                {saving ? 'Saqlanmoqda…' : 'Yaratish'}
              </button>
              <button onClick={() => setCreating(false)} className="btn-ghost text-sm px-4 py-1.5">
                Bekor qilish
              </button>
            </div>
          </div>
        </div>
      )}

      {collections.length === 0 ? (
        <p className="text-parchment-dim text-center py-16">
          Hali to'plam yaratilmagan. Birinchi to'plamingizni yarating!
        </p>
      ) : (
        <div className="space-y-4">
          {collections.map((col) => {
            const isExpanded = expanded === col._id;
            return (
              <div key={col._id} className="card border border-ink-600">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-parchment font-medium">{col.title}</p>
                    {col.niche && <p className="text-xs text-parchment-faint mt-0.5">#{col.niche}</p>}
                    <p className="text-xs text-parchment-dim mt-1">
                      {col.quoteCount || col.quotes?.length || 0} stata ·{' '}
                      {col.views || 0} ko'rish ·{' '}
                      {col.isPublic ? '🌐 Ochiq' : '🔒 Yopiq'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {col.isPublic && (
                      <button
                        onClick={() => copyUrl(col.slug)}
                        className="text-xs text-amber hover:underline"
                      >
                        {copiedSlug === col.slug ? '✓ Nusxalandi' : '🔗 Havola'}
                      </button>
                    )}
                    <button
                      onClick={() => setExpanded(isExpanded ? null : col._id)}
                      className="text-xs text-parchment-dim hover:text-parchment"
                    >
                      {isExpanded ? '▲' : '▼ Statalar'}
                    </button>
                    <button onClick={() => deleteCollection(col._id)} className="text-xs text-red-400 hover:text-red-300">
                      🗑
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-4 border-t border-ink-600 pt-4">
                    <p className="text-xs text-parchment-dim mb-2">Stata qidirish va qo'shish:</p>
                    <div className="flex gap-2 mb-3">
                      <input
                        className="input flex-1 text-sm"
                        placeholder="Stata matni yoki kitob nomi…"
                        value={quoteSearch}
                        onChange={(e) => searchQuotes(e.target.value)}
                      />
                      {searching && <span className="text-parchment-faint text-xs self-center">…</span>}
                    </div>
                    {quoteResults.length > 0 && (
                      <div className="space-y-2 mb-4 max-h-60 overflow-y-auto">
                        {quoteResults.map((q) => {
                          const added = (col.quotes || []).map(String).includes(String(q._id));
                          return (
                            <div key={q._id} className="flex items-start gap-2 rounded bg-ink-800 p-2">
                              <p className="flex-1 text-xs text-parchment line-clamp-2">
                                "{q.text}"
                                {q.bookId && (
                                  <span className="text-parchment-faint ml-1">— {q.bookId.titleUz || q.bookId.title}</span>
                                )}
                              </p>
                              <button
                                onClick={() => toggleQuote(col, q._id)}
                                className={`shrink-0 rounded px-2 py-0.5 text-xs ${added ? 'bg-amber text-ink-900' : 'border border-amber text-amber'}`}
                              >
                                {added ? "✓ Qo'shilgan" : "+ Qo'shish"}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {col.quotes?.length > 0 && (
                      <p className="text-xs text-parchment-faint">{col.quotes.length} ta stata qo'shilgan</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Widget section ───────────────────────────────────────────────────────────
function WidgetSection({ userId, isPremium }) {
  const [copiedIdx, setCopiedIdx] = useState(null);
  const [bookId, setBookId]       = useState('');
  const base = window.location.origin;

  const widgets = [
    {
      label: '🔍 Qidiruv widget',
      desc: "Foydalanuvchilar to'g'ridan-to'g'ri blogingizdan kitob qidira oladi.",
      code: `<iframe\n  src="${base}/widget/search?blogger=${userId}&theme=dark"\n  width="100%"\n  height="520"\n  frameborder="0"\n  style="border-radius:12px"\n></iframe>`
    },
    {
      label: '☀️ Kunlik stata',
      desc: 'Har kuni avtomatik yangilanib turadigan yangi stata.',
      code: `<iframe\n  src="${base}/widget/daily?blogger=${userId}"\n  width="100%"\n  height="200"\n  frameborder="0"\n  style="border-radius:12px"\n></iframe>`
    },
    {
      label: '📖 Kitob statalar slayderi',
      desc: "Muayyan kitob statalarini slider sifatida ko'rsating. Kitob IDsini kiriting:",
      code: bookId
        ? `<iframe\n  src="${base}/widget/book/${bookId}?blogger=${userId}"\n  width="100%"\n  height="300"\n  frameborder="0"\n  style="border-radius:12px"\n></iframe>`
        : null
    }
  ];

  const copy = async (code, idx) => {
    try { await navigator.clipboard.writeText(code); }
    catch { window.prompt('Kodni nusxalang:', code); }
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2500);
  };

  if (!isPremium) {
    return (
      <div>
        <h2 className="mb-5 text-2xl text-parchment">Widget</h2>
        <div className="card text-center py-12">
          <p className="text-3xl mb-3">🔒</p>
          <p className="text-parchment mb-2">Widget premium bloggerlar uchun</p>
          <p className="text-sm text-parchment-dim mb-4">
            Blogingizga qidiruv, kunlik stata va kitob slayder widgetlarini qo'yish uchun Premium oling.
          </p>
          <a href="/premium" className="btn-primary inline-block text-sm px-5 py-2">Premium olish</a>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="mb-5 text-2xl text-parchment">Widget</h2>
      <p className="text-sm text-parchment-dim mb-6">
        Quyidagi kodlarni blogingiz yoki veb-saytingizga joylashtiring.
      </p>
      <div className="space-y-6">
        {widgets.map((w, i) => (
          <div key={i} className="card border border-ink-600">
            <h3 className="text-parchment mb-1">{w.label}</h3>
            <p className="text-xs text-parchment-faint mb-3">{w.desc}</p>
            {i === 2 && (
              <input
                className="input w-full text-sm mb-3"
                placeholder="Kitob ID sini kiriting (URL dan)"
                value={bookId}
                onChange={(e) => setBookId(e.target.value.trim())}
              />
            )}
            {w.code ? (
              <>
                <pre className="overflow-x-auto rounded-lg bg-ink-900 p-3 text-xs text-parchment-dim whitespace-pre-wrap">
                  {w.code}
                </pre>
                <button
                  onClick={() => copy(w.code, i)}
                  className="mt-2 text-xs text-amber hover:underline"
                >
                  {copiedIdx === i ? '✓ Nusxalandi!' : '📋 Kodni nusxalash'}
                </button>
              </>
            ) : (
              <p className="text-xs text-parchment-faint italic">Kitob IDsini kiriting.</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Profile section ──────────────────────────────────────────────────────────
function ProfileSection({ user }) {
  const bp = user?.bloggerProfile || {};
  const [form, setForm] = useState({
    channelName: bp.channelName || '',
    channelLink: bp.channelLink || '',
    followers:   bp.followers   || 0,
    niche:       bp.niche       || '',
    bio:         bp.bio         || ''
  });
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put('/blogger/profile', form);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {}
    finally { setSaving(false); }
  };

  const f = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  return (
    <div>
      <h2 className="mb-5 text-2xl text-parchment">Blogger profil</h2>
      <div className="card max-w-xl">
        {bp.verifiedBadge && (
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-amber/10 px-3 py-2">
            <span className="text-amber">✓</span>
            <span className="text-sm text-amber">Tasdiqlangan blogger</span>
          </div>
        )}
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-xs text-parchment-dim mb-1">Kanal nomi</label>
            <input className="input w-full" value={form.channelName} onChange={f('channelName')} placeholder="@kanalim" />
          </div>
          <div>
            <label className="block text-xs text-parchment-dim mb-1">Kanal havolasi</label>
            <input className="input w-full" value={form.channelLink} onChange={f('channelLink')} placeholder="https://t.me/kanalim" />
          </div>
          <div>
            <label className="block text-xs text-parchment-dim mb-1">Obunachilar soni</label>
            <input className="input w-full" type="number" min="0" value={form.followers} onChange={f('followers')} placeholder="1000" />
          </div>
          <div>
            <label className="block text-xs text-parchment-dim mb-1">Yo'nalish (niche)</label>
            <input className="input w-full" value={form.niche} onChange={f('niche')} placeholder="kitoblar, motivatsiya, psixologiya" />
          </div>
          <div>
            <label className="block text-xs text-parchment-dim mb-1">Bio</label>
            <textarea
              className="input w-full resize-none"
              rows={3}
              value={form.bio}
              onChange={f('bio')}
              maxLength={500}
              placeholder="O'zingiz haqingizda qisqacha…"
            />
          </div>
          <button type="submit" disabled={saving} className="btn-primary px-5 py-2 text-sm">
            {saved ? '✓ Saqlandi!' : saving ? 'Saqlanmoqda…' : 'Saqlash'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Apply section ────────────────────────────────────────────────────────────
function ApplySection() {
  const [application, setApplication] = useState(undefined);
  const [loading, setLoading]         = useState(true);
  const [form, setForm] = useState({ channelName: '', channelLink: '', followers: '', niche: '', bio: '' });
  const [submitting, setSubmitting]   = useState(false);
  const [submitted, setSubmitted]     = useState(false);
  const [error, setError]             = useState('');

  useEffect(() => {
    api.get('/blogger/application')
      .then((r) => setApplication(r.data.application))
      .catch(() => setApplication(null))
      .finally(() => setLoading(false));
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.channelName || !form.channelLink) { setError('Kanal nomi va havolasi majburiy'); return; }
    setSubmitting(true); setError('');
    try {
      await api.post('/blogger/apply', { ...form, followers: Number(form.followers) || 0 });
      setSubmitted(true);
      setApplication({ status: 'pending' });
    } catch (err) {
      const msg = err?.response?.data?.error;
      if (msg === 'application_exists') setApplication({ status: err?.response?.data?.status || 'pending' });
      else setError("Xatolik yuz berdi. Qayta urinib ko'ring.");
    } finally { setSubmitting(false); }
  };

  const f = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  if (loading) return <p className="text-parchment-dim py-10 text-center">Yuklanmoqda…</p>;

  const statusMap = {
    pending:  { icon: '⏳', text: "Arizangiz ko'rib chiqilmoqda. Odatda 1–3 ish kuni ichida javob beriladi." },
    approved: { icon: '✅', text: 'Arizangiz tasdiqlandi! Sahifani yangilang.' },
    rejected: { icon: '❌', text: "Ariza qabul qilinmadi. Yangi ariza yuborish uchun admin bilan bog'laning." }
  };

  if (application) {
    const s = statusMap[application.status] || statusMap.pending;
    return (
      <div>
        <h2 className="mb-5 text-2xl text-parchment">Blogger ariza</h2>
        <div className="card text-center py-12 max-w-md">
          <p className="text-4xl mb-3">{s.icon}</p>
          <p className="text-parchment">{s.text}</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="mb-5 text-2xl text-parchment">Blogger bo'lish uchun ariza</h2>
      <div className="card max-w-xl">
        <p className="text-sm text-parchment-dim mb-5">
          StatBooks bloggerlar uchun maxsus imkoniyatlar: to'plamlar, widget, statistika va "Tasdiqlangan blogger" nishoni.
        </p>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-xs text-parchment-dim mb-1">Kanal nomi *</label>
            <input className="input w-full" value={form.channelName} onChange={f('channelName')} placeholder="@kanalim" required />
          </div>
          <div>
            <label className="block text-xs text-parchment-dim mb-1">Kanal havolasi *</label>
            <input className="input w-full" value={form.channelLink} onChange={f('channelLink')} placeholder="https://t.me/kanalim" required />
          </div>
          <div>
            <label className="block text-xs text-parchment-dim mb-1">Taxminiy obunachilar soni</label>
            <input className="input w-full" type="number" min="0" value={form.followers} onChange={f('followers')} placeholder="500" />
          </div>
          <div>
            <label className="block text-xs text-parchment-dim mb-1">Kanal yo'nalishi</label>
            <input className="input w-full" value={form.niche} onChange={f('niche')} placeholder="kitoblar, psixologiya, motivatsiya" />
          </div>
          <div>
            <label className="block text-xs text-parchment-dim mb-1">O'zingiz haqingizda</label>
            <textarea className="input w-full resize-none" rows={3} value={form.bio} onChange={f('bio')} maxLength={500} />
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          {submitted && <p className="text-green-400 text-sm">✓ Ariza muvaffaqiyatli yuborildi!</p>}
          <button type="submit" disabled={submitting} className="btn-primary w-full py-2 text-sm">
            {submitting ? 'Yuborilmoqda…' : 'Ariza yuborish'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Sidebar tabs ─────────────────────────────────────────────────────────────
const BLOGGER_TABS = [
  { id: 'stats',       icon: '📊', label: 'Statistika'         },
  { id: 'books',       icon: '📚', label: 'Kitoblar'           },
  { id: 'collections', icon: '🎯', label: "To'plamlar"         },
  { id: 'widget',      icon: '🔧', label: 'Widget'             },
  { id: 'profile',     icon: '👤', label: 'Profil'             },
];
const GUEST_TABS = [
  { id: 'stats',  icon: '📊', label: 'Statistika'          },
  { id: 'books',  icon: '📚', label: 'Kitoblar'            },
  { id: 'apply',  icon: '✋', label: "Blogger bo'lish"     },
];

// ─── Main export ──────────────────────────────────────────────────────────────
export default function BloggerPanel() {
  const user        = useAuthStore((s) => s.user);
  const isPremiumFn = useAuthStore((s) => s.isPremium);
  const isPremium   = isPremiumFn();

  const [activeTab, setActiveTab]     = useState('stats');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const tabs = user?.isBlogger ? BLOGGER_TABS : GUEST_TABS;

  // Keep active tab valid when switching blogger status
  useEffect(() => {
    const ids = tabs.map((t) => t.id);
    if (!ids.includes(activeTab)) setActiveTab('stats');
  }, [user?.isBlogger]);

  const renderSection = () => {
    switch (activeTab) {
      case 'stats':       return <StatsSection />;
      case 'books':       return <BooksSection />;
      case 'collections': return <CollectionsSection isPremium={isPremium} />;
      case 'widget':      return <WidgetSection userId={user?.id} isPremium={isPremium} />;
      case 'profile':     return <ProfileSection user={user} />;
      case 'apply':       return <ApplySection />;
      default:            return null;
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display text-parchment">Blogger Panel</h1>
          <p className="mt-1 text-sm text-parchment-dim">
            {user?.isBlogger
              ? (user?.bloggerProfile?.verifiedBadge ? '✓ Tasdiqlangan blogger' : 'Blogger akkaunt')
              : 'Kitoblar statistikasi va blogger imkoniyatlari'}
          </p>
        </div>
        <button
          className="lg:hidden text-parchment-dim text-xl"
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          ☰
        </button>
      </div>

      <div className="flex gap-6">
        {/* Sidebar */}
        <aside className={`${sidebarOpen ? 'block' : 'hidden'} lg:block w-48 shrink-0`}>
          <nav className="space-y-1 sticky top-24">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-left transition-colors ${
                  activeTab === tab.id
                    ? 'bg-amber text-ink-900 font-medium'
                    : 'text-parchment-dim hover:text-parchment hover:bg-ink-700'
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </aside>

        {/* Content */}
        <main className="flex-1 min-w-0">
          {renderSection()}
        </main>
      </div>
    </div>
  );
}
