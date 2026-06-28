import { useState, useRef, useEffect, useCallback } from 'react';
import api from '../services/api';

const THEMES = {
  night:  { label: 'Tungi',    bg: '#1A1814', text: '#F5F0E8', accent: '#E8A94A' },
  day:    { label: 'Kunduzgi', bg: '#F5F0E8', text: '#1A1814', accent: '#C4893A' },
  sepia:  { label: 'Sepiya',   bg: '#2C2416', text: '#E8D5B0', accent: '#D4A857' },
  forest: { label: "O'rmon",   bg: '#1A2420', text: '#E0EDE5', accent: '#7DCAA5' },
  royal:  { label: 'Shohona',  bg: '#1A1A2E', text: '#E8E8F0', accent: '#9F8FEF' },
};

const FORMATS = {
  square:  { label: 'Instagram post',   w: 1080, h: 1080 },
  story:   { label: 'Instagram story',  w: 1080, h: 1920 },
  twitter: { label: 'Twitter/Telegram', w: 1200, h: 675  },
};

function wrapText(ctx, text, maxWidth) {
  const words = (text || '').split(/\s+/);
  const lines = [];
  let current = '';
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

async function loadFonts() {
  await Promise.allSettled([
    document.fonts.load(`italic 500 48px 'Playfair Display'`),
    document.fonts.load(`700 48px 'Playfair Display'`),
    document.fonts.load(`500 48px 'Playfair Display'`),
  ]);
}

function drawCard(ctx, th, fmt, quoteText, author, bookTitle, bgBitmap) {
  const { w, h } = fmt;
  const isLandscape = w > h;
  const ref = Math.min(w, h);

  ctx.clearRect(0, 0, w, h);

  // Solid background fill
  ctx.fillStyle = th.bg;
  ctx.fillRect(0, 0, w, h);

  // Background image at 15% opacity — cover fit (like CSS object-cover)
  if (bgBitmap) {
    const imgAspect = bgBitmap.width / bgBitmap.height;
    const canvasAspect = w / h;
    let sx = 0, sy = 0, sw = bgBitmap.width, sh = bgBitmap.height;
    if (imgAspect > canvasAspect) {
      sw = bgBitmap.height * canvasAspect;
      sx = (bgBitmap.width - sw) / 2;
    } else {
      sh = bgBitmap.width / canvasAspect;
      sy = (bgBitmap.height - sh) / 2;
    }
    ctx.save();
    ctx.globalAlpha = 0.15;
    ctx.drawImage(bgBitmap, sx, sy, sw, sh, 0, 0, w, h);
    ctx.restore();
  }

  // Vignette overlay
  const vg = ctx.createRadialGradient(w / 2, h / 2, ref * 0.28, w / 2, h / 2, ref * 0.88);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.22)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, w, h);

  const pad = Math.round(w * 0.085);
  const cw = w - pad * 2;

  // Corner decorations
  const corner = Math.round(ref * 0.055);
  const lw = Math.max(1.5, ref * 0.002);
  ctx.save();
  ctx.strokeStyle = th.accent;
  ctx.lineWidth = lw;
  ctx.globalAlpha = 0.38;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(pad - 12, pad - 12 + corner); ctx.lineTo(pad - 12, pad - 12); ctx.lineTo(pad - 12 + corner, pad - 12);
  ctx.moveTo(w - pad + 12 - corner, h - pad + 12); ctx.lineTo(w - pad + 12, h - pad + 12); ctx.lineTo(w - pad + 12, h - pad + 12 - corner);
  ctx.stroke();
  ctx.restore();

  // Big opening quote mark ❝
  const qMarkSize = Math.round(ref * (isLandscape ? 0.2 : 0.148));
  ctx.save();
  ctx.font = `${qMarkSize}px 'Playfair Display', Georgia, serif`;
  ctx.fillStyle = th.accent;
  ctx.globalAlpha = 0.9;
  const qMarkY = isLandscape ? Math.round(h * 0.31) : Math.round(h * 0.2);
  ctx.fillText('❝', pad - 4, qMarkY);
  ctx.restore();

  // Quote text — italic, Playfair Display
  const qSize = Math.round(ref * (isLandscape ? 0.052 : 0.038));
  ctx.font = `italic 500 ${qSize}px 'Playfair Display', Georgia, serif`;
  ctx.fillStyle = th.text;

  const maxLines = isLandscape ? 5 : 9;
  let lines = wrapText(ctx, quoteText || '', cw);
  if (lines.length > maxLines) {
    lines = lines.slice(0, maxLines - 1);
    lines.push('…');
  }

  const lineH = Math.round(qSize * 1.68);
  const qStartY = isLandscape
    ? Math.round(h * 0.355)
    : qMarkY + Math.round(h * 0.028);

  let curY = qStartY;
  for (const line of lines) {
    ctx.fillText(line, pad, curY);
    curY += lineH;
  }

  // Separator — short accent line
  const sepY = curY + Math.round(h * 0.028);
  ctx.strokeStyle = th.accent;
  ctx.lineWidth = Math.max(1.5, ref * 0.002);
  ctx.beginPath();
  ctx.moveTo(pad, sepY);
  ctx.lineTo(pad + Math.round(cw * 0.1), sepY);
  ctx.stroke();

  // Author name — bold, accent color
  const aSize = Math.round(ref * 0.028);
  ctx.font = `700 ${aSize}px 'Playfair Display', Georgia, serif`;
  ctx.fillStyle = th.accent;
  const authorY = sepY + Math.round(aSize * 2.0);
  if (author) ctx.fillText(`— ${author}`, pad, authorY);

  // Book title — lighter
  const bSize = Math.round(ref * 0.021);
  ctx.font = `500 ${bSize}px 'Playfair Display', Georgia, serif`;
  ctx.fillStyle = th.text;
  ctx.globalAlpha = 0.58;
  const bookY = authorY + Math.round(bSize * 2.1);
  if (bookTitle) {
    const t = bookTitle.length > 58 ? bookTitle.slice(0, 55) + '…' : bookTitle;
    ctx.fillText(t, pad, bookY);
  }
  ctx.globalAlpha = 1;

  // Watermark — bottom right
  const wmSize = Math.round(ref * 0.019);
  ctx.font = `${wmSize}px 'Playfair Display', Georgia, serif`;
  ctx.fillStyle = th.text;
  ctx.globalAlpha = 0.3;
  const wm = 'statbooks.uz';
  const wmW = ctx.measureText(wm).width;
  ctx.fillText(wm, w - pad - wmW, h - Math.round(h * 0.038));
  ctx.globalAlpha = 1;
}

const PREVIEW_MAX = 330;

export default function QuoteCardGenerator({ text, author, bookTitle, bookId, onClose }) {
  const [theme, setTheme]         = useState('night');
  const [format, setFormat]       = useState('square');
  const [downloading, setDownloading] = useState(false);
  const [activeText, setActiveText]   = useState(text || '');
  const [quotes, setQuotes]       = useState([]);
  const [loadingQuotes, setLoadingQuotes] = useState(false);
  const [bgBitmap, setBgBitmap]   = useState(null);
  const [bgName, setBgName]       = useState('');
  const canvasRef    = useRef(null);
  const fileRef      = useRef(null);
  const bgBitmapRef  = useRef(null);

  // Release ImageBitmap GPU memory on unmount
  useEffect(() => () => { bgBitmapRef.current?.close(); }, []);

  // Fetch book's AI preview sentences when bookId is available
  useEffect(() => {
    if (!bookId) return;
    setLoadingQuotes(true);
    api
      .get(`/books/${bookId}/preview`, { params: { lang: 'uz' } })
      .then((res) => {
        const pages = res.data?.previewPages || [];
        if (pages.length > 0) setQuotes(pages);
      })
      .catch(() => {})
      .finally(() => setLoadingQuotes(false));
  }, [bookId]);

  // Handle user-uploaded background image
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const bm = await createImageBitmap(file);
      bgBitmapRef.current?.close();
      bgBitmapRef.current = bm;
      setBgBitmap(bm);
      setBgName(file.name.replace(/\.[^/.]+$/, ''));
    } catch {
      // ignore unsupported formats
    }
    e.target.value = '';
  };

  const removeBg = () => {
    bgBitmapRef.current?.close();
    bgBitmapRef.current = null;
    setBgBitmap(null);
    setBgName('');
  };

  // Draw canvas whenever any input changes
  const renderCanvas = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const fmt = FORMATS[format];
    canvas.width  = fmt.w;
    canvas.height = fmt.h;
    await loadFonts();
    const ctx = canvas.getContext('2d');
    drawCard(ctx, THEMES[theme], fmt, activeText, author, bookTitle, bgBitmap);
  }, [theme, format, activeText, author, bookTitle, bgBitmap]);

  useEffect(() => { renderCanvas(); }, [renderCanvas]);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await renderCanvas();
      await new Promise((resolve) => {
        canvasRef.current?.toBlob((blob) => {
          if (blob) {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `statbooks-${theme}-${format}.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }
          resolve();
        }, 'image/png');
      });
    } finally {
      setDownloading(false);
    }
  };

  const fmt   = FORMATS[format];
  const scale = Math.min(PREVIEW_MAX / fmt.w, PREVIEW_MAX / fmt.h);
  const prevW = Math.round(fmt.w * scale);
  const prevH = Math.round(fmt.h * scale);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/75 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-ink-600 bg-ink-800 shadow-2xl animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex flex-shrink-0 items-center justify-between border-b border-ink-600 px-5 py-3.5">
          <h2 className="font-display text-base text-parchment">Stata kartasi</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-parchment-faint transition-colors hover:bg-ink-700 hover:text-parchment"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex min-h-0 flex-1 flex-col sm:flex-row">

          {/* ── Controls panel (scrollable) ── */}
          <div className="flex-shrink-0 overflow-y-auto border-b border-ink-600 sm:w-64 sm:border-b-0 sm:border-r">
            <div className="space-y-4 p-4">

              {/* Background image */}
              <div>
                <p className="mb-2 text-[11px] font-medium uppercase tracking-widest text-parchment-faint">
                  Fon rasmi (15% shaffof)
                </p>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                {bgBitmap && (
                  <div className="mb-1.5 flex items-center gap-2 rounded-lg bg-ink-700 px-2.5 py-1.5">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="flex-shrink-0 text-amber">
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" />
                    </svg>
                    <span className="flex-1 truncate text-xs text-parchment-dim">{bgName}</span>
                    <button onClick={removeBg} className="text-parchment-faint transition-colors hover:text-red-400">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                )}
                <button
                  onClick={() => fileRef.current?.click()}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-ink-600 py-2.5 text-xs text-parchment-faint transition-colors hover:border-amber/50 hover:text-parchment"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
                  </svg>
                  {bgBitmap ? 'Boshqa rasm' : 'Rasm yuklash'}
                </button>
              </div>

              {/* Theme */}
              <div>
                <p className="mb-2.5 text-[11px] font-medium uppercase tracking-widest text-parchment-faint">Tema</p>
                <div className="flex flex-wrap gap-2.5">
                  {Object.entries(THEMES).map(([key, th]) => (
                    <button
                      key={key}
                      onClick={() => setTheme(key)}
                      title={th.label}
                      className={`relative h-9 w-9 rounded-full border-2 transition-all duration-150 ${
                        theme === key
                          ? 'scale-110 border-amber shadow-lg'
                          : 'border-ink-600 hover:scale-105 hover:border-parchment-faint'
                      }`}
                      style={{ background: th.bg }}
                    >
                      <span
                        className="absolute inset-1 rounded-full"
                        style={{ background: `linear-gradient(135deg, ${th.accent}88, transparent)` }}
                      />
                      {theme === key && (
                        <svg
                          className="absolute inset-0 m-auto"
                          width="13" height="13" viewBox="0 0 24 24"
                          fill="none" stroke={th.text} strokeWidth="3" strokeLinecap="round"
                        >
                          <path d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-xs font-medium text-amber">{THEMES[theme].label}</p>
              </div>

              {/* Format */}
              <div>
                <p className="mb-2 text-[11px] font-medium uppercase tracking-widest text-parchment-faint">Format</p>
                <div className="space-y-1.5">
                  {Object.entries(FORMATS).map(([key, f]) => (
                    <button
                      key={key}
                      onClick={() => setFormat(key)}
                      className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors ${
                        format === key
                          ? 'border border-amber/35 bg-amber/12 text-amber'
                          : 'border border-transparent bg-ink-700 text-parchment-dim hover:text-parchment'
                      }`}
                    >
                      <span>{f.label}</span>
                      <span className="text-[11px] opacity-55">{f.w}×{f.h}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Editable quote text */}
              <div>
                <p className="mb-2 text-[11px] font-medium uppercase tracking-widest text-parchment-faint">
                  Iqtibos matni
                </p>
                <textarea
                  value={activeText}
                  onChange={(e) => setActiveText(e.target.value)}
                  rows={4}
                  className="w-full resize-none rounded-lg border border-ink-600 bg-ink-700 px-3 py-2 text-xs text-parchment placeholder-parchment-faint transition-colors focus:border-amber/50 focus:outline-none"
                  placeholder="Iqtibosni shu yerga kiriting..."
                />
              </div>

              {/* Book quotes selector */}
              {(loadingQuotes || quotes.length > 0) && (
                <div>
                  <p className="mb-2 text-[11px] font-medium uppercase tracking-widest text-parchment-faint">
                    Kitobning eng yaxshi gaplari
                  </p>
                  {loadingQuotes ? (
                    <div className="space-y-2">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="skeleton h-12 rounded-lg" />
                      ))}
                    </div>
                  ) : (
                    <div className="max-h-52 space-y-1 overflow-y-auto pr-0.5">
                      {quotes.map((q, i) => (
                        <button
                          key={i}
                          onClick={() => setActiveText(q)}
                          className={`w-full rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                            activeText === q
                              ? 'border-amber/35 bg-amber/15 text-amber'
                              : 'border-transparent bg-ink-700 text-parchment-dim hover:bg-ink-600 hover:text-parchment'
                          }`}
                        >
                          <span className="line-clamp-2 italic leading-relaxed">{q}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Download */}
              <button
                onClick={handleDownload}
                disabled={downloading}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-amber px-4 py-2.5 text-sm font-semibold text-ink transition-all hover:bg-amber-300 active:scale-95 disabled:opacity-60"
              >
                {downloading ? (
                  <>
                    <svg className="animate-spin" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                    </svg>
                    Yuklanmoqda…
                  </>
                ) : (
                  <>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
                    </svg>
                    PNG yuklab olish
                  </>
                )}
              </button>

            </div>
          </div>

          {/* ── Canvas preview ── */}
          <div className="flex flex-1 items-center justify-center overflow-hidden bg-ink/60 p-5">
            <div
              className="relative overflow-hidden rounded-lg shadow-2xl"
              style={{ width: prevW, height: prevH }}
            >
              <canvas
                ref={canvasRef}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  transformOrigin: 'top left',
                  transform: `scale(${scale})`,
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
