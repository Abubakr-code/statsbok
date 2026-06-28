const express = require('express');
const mongoose = require('mongoose');
const Quote = require('../models/Quote');

const router = express.Router();

const FRONTEND = (process.env.FRONTEND_URL || 'https://statbooks.uz').replace(/\/$/, '');

// Resolve the public backend URL (for og:image absolute URL)
function backendUrl(req) {
  const configured = process.env.BACKEND_PUBLIC_URL || process.env.RENDER_EXTERNAL_URL;
  if (configured) return configured.replace(/\/$/, '');
  return `${req.protocol}://${req.get('host')}`;
}

function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── GET /api/share/quote/:id ─────────────────────────────────────────────────
// Returns an HTML page with OG/Twitter meta tags.
// Human visitors are immediately JS-redirected to the frontend.
// Social crawlers (Telegram, Twitter) read the meta tags.

router.get('/quote/:id', async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.redirect(302, FRONTEND);
    }

    const quote = await Quote.findById(req.params.id).populate('bookId').lean();
    if (!quote) return res.redirect(302, FRONTEND);

    const book = quote.bookId || {};
    const rawText = String(quote.text || '');
    const ogTitle = rawText.length > 60 ? rawText.slice(0, 57) + '...' : rawText;
    const bookTitle = book.titleUz || book.title || '';
    const author = book.author || '';
    const ogDesc = [author, bookTitle].filter(Boolean).join(' — ') || 'StatBooks — Kitob iqtiboslari';
    const base = backendUrl(req);
    const ogImage = `${base}/api/share/og-image/${req.params.id}`;
    const ogUrl = `${FRONTEND}/quote/${req.params.id}`;
    const redirectUrl = `${FRONTEND}/search?q=${encodeURIComponent(rawText.slice(0, 100))}`;
    const displayText = rawText.length > 300 ? rawText.slice(0, 297) + '...' : rawText;

    const html = `<!DOCTYPE html>
<html lang="uz">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escHtml(ogTitle)} — StatBooks</title>

  <!-- Open Graph -->
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="StatBooks">
  <meta property="og:title" content="${escHtml(ogTitle)}">
  <meta property="og:description" content="${escHtml(ogDesc)}">
  <meta property="og:image" content="${escHtml(ogImage)}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:type" content="image/png">
  <meta property="og:url" content="${escHtml(ogUrl)}">

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escHtml(ogTitle)}">
  <meta name="twitter:description" content="${escHtml(ogDesc)}">
  <meta name="twitter:image" content="${escHtml(ogImage)}">

  <meta http-equiv="refresh" content="0;url=${escHtml(redirectUrl)}">
  <script>window.location.replace(${JSON.stringify(redirectUrl)});</script>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{background:#1A1814;color:#F5F0E8;font-family:Georgia,serif;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:2rem;text-align:center}
    blockquote{font-size:1.3rem;line-height:1.85;max-width:640px;font-style:italic;color:#F5F0E8}
    .meta{color:#E8A94A;margin-top:1.2rem;font-size:1rem}
    .note{color:#6B6050;font-size:0.85rem;margin-top:2rem}
  </style>
</head>
<body>
  <div>
    <blockquote>&#x201C;${escHtml(displayText)}&#x201D;</blockquote>
    ${ogDesc !== 'StatBooks — Kitob iqtiboslari' ? `<p class="meta">— ${escHtml(ogDesc)}</p>` : ''}
    <p class="note">statbooks.uz ga yo&#x2018;naltirilmoqda&hellip;</p>
  </div>
</body>
</html>`;

    res.set('Content-Type', 'text/html; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=3600');
    res.send(html);
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/share/og-image/:id ─────────────────────────────────────────────
// Generates a 1200×630 PNG for OG previews using @napi-rs/canvas.

// Simple in-memory cache so repeated crawls don't regenerate images
const imageCache = new Map();
const IMAGE_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of imageCache) {
    if (now - v.ts > IMAGE_CACHE_TTL) imageCache.delete(k);
  }
}, 60 * 60 * 1000).unref();

router.get('/og-image/:id', async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).end();
    }

    const cached = imageCache.get(req.params.id);
    if (cached) {
      res.set('Content-Type', 'image/png');
      res.set('Cache-Control', 'public, max-age=86400');
      res.set('X-Cache', 'HIT');
      return res.send(cached.buf);
    }

    const quote = await Quote.findById(req.params.id).populate('bookId').lean();
    if (!quote) return res.status(404).end();

    let createCanvas;
    try {
      ({ createCanvas } = require('@napi-rs/canvas'));
    } catch {
      return res.status(503).json({ error: 'Image generation not available' });
    }

    const W = 1200, H = 630;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');

    const book = quote.bookId || {};
    const quoteText = String(quote.text || '');
    const author = book.author || '';
    const bookTitle = book.titleUz || book.title || '';

    // Background
    ctx.fillStyle = '#1A1814';
    ctx.fillRect(0, 0, W, H);

    // Amber accent bars
    ctx.fillStyle = '#E8A94A';
    ctx.fillRect(0, 0, W, 7);
    ctx.fillRect(0, H - 7, W, 7);
    ctx.fillRect(0, 0, 7, H);

    // Faint corner decorations
    ctx.save();
    ctx.strokeStyle = '#E8A94A';
    ctx.lineWidth = 2.5;
    ctx.globalAlpha = 0.35;
    ctx.lineCap = 'round';
    const PAD = 52, CORNER = 36;
    ctx.beginPath();
    ctx.moveTo(PAD, PAD + CORNER); ctx.lineTo(PAD, PAD); ctx.lineTo(PAD + CORNER, PAD);
    ctx.moveTo(W - PAD - CORNER, H - PAD); ctx.lineTo(W - PAD, H - PAD); ctx.lineTo(W - PAD, H - PAD - CORNER);
    ctx.stroke();
    ctx.restore();

    // Large faint opening quote mark
    ctx.save();
    ctx.fillStyle = '#E8A94A';
    ctx.globalAlpha = 0.12;
    ctx.font = 'bold 280px serif';
    ctx.fillText('“', 32, 250);
    ctx.restore();

    // Quote text — wrap & render
    const maxLineW = W - 180;
    ctx.fillStyle = '#F5F0E8';
    ctx.font = 'italic 36px serif';
    const lines = wrapText(ctx, quoteText, maxLineW, 8);
    const lineH = 54;
    const textBlockH = lines.length * lineH;
    const metaH = (author ? 52 : 0) + (bookTitle ? 40 : 0) + 50;
    let y = Math.max(110, Math.round((H - textBlockH - metaH) / 2));

    for (const line of lines) {
      ctx.fillText(line, 90, y);
      y += lineH;
    }

    // Separator
    y += 20;
    ctx.strokeStyle = '#E8A94A';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(90, y); ctx.lineTo(90 + 100, y);
    ctx.stroke();
    y += 38;

    // Author name
    if (author) {
      ctx.fillStyle = '#E8A94A';
      ctx.font = 'bold 26px serif';
      ctx.fillText(`— ${author}`, 90, y);
      y += 42;
    }

    // Book title
    if (bookTitle) {
      ctx.save();
      ctx.fillStyle = '#F5F0E8';
      ctx.globalAlpha = 0.52;
      ctx.font = '20px serif';
      const shortTitle = bookTitle.length > 68 ? bookTitle.slice(0, 65) + '…' : bookTitle;
      ctx.fillText(shortTitle, 90, y);
      ctx.restore();
    }

    // Watermark
    ctx.save();
    ctx.fillStyle = '#F5F0E8';
    ctx.globalAlpha = 0.28;
    ctx.font = '20px serif';
    const wm = 'statbooks.uz';
    const wmW = ctx.measureText(wm).width;
    ctx.fillText(wm, W - wmW - 48, H - 30);
    ctx.restore();

    const png = canvas.toBuffer('image/png');
    imageCache.set(req.params.id, { buf: png, ts: Date.now() });

    res.set('Content-Type', 'image/png');
    res.set('Cache-Control', 'public, max-age=86400');
    res.send(png);
  } catch (err) {
    next(err);
  }
});

function wrapText(ctx, text, maxWidth, maxLines) {
  const words = String(text || '').split(/\s+/);
  const lines = [];
  let current = '';
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      if (lines.length >= maxLines) { lines[lines.length - 1] += '…'; break; }
      current = word;
    } else {
      current = test;
    }
  }
  if (current && lines.length < maxLines) lines.push(current);
  return lines;
}

module.exports = router;
