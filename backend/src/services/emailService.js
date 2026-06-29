/**
 * Email verification helpers.
 *
 * - Validates email format.
 * - Checks the domain has MX records (rejects fake/undeliverable domains).
 * - Sends a 6-digit code via Resend (https://resend.com).
 *   If RESEND_API_KEY is not set, the code is logged to the console so the
 *   flow still works in local development.
 */

const dns = require('dns').promises;
const crypto = require('crypto');
const nodemailer = require('nodemailer');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESEND_URL = 'https://api.resend.com/emails';
const DISPOSABLE_DOMAINS = new Set([
  '10minutemail.com',
  '20minutemail.com',
  'anonaddy.com',
  'dispostable.com',
  'emailondeck.com',
  'fakeinbox.com',
  'guerrillamail.com',
  'maildrop.cc',
  'mailinator.com',
  'moakt.com',
  'sharklasers.com',
  'tempmail.com',
  'temp-mail.org',
  'throwawaymail.com',
  'trashmail.com',
  'yopmail.com'
]);

function normalizeEmail(email) {
  const value = String(email || '').trim().toLowerCase();
  const [rawLocal, rawDomain] = value.split('@');
  if (!rawLocal || !rawDomain) return value;

  const domain = rawDomain === 'googlemail.com' ? 'gmail.com' : rawDomain;
  if (domain === 'gmail.com') {
    const local = rawLocal.split('+')[0].replace(/\./g, '');
    return `${local}@${domain}`;
  }

  return `${rawLocal}@${domain}`;
}

function isValidFormat(email) {
  return EMAIL_RE.test(String(email || '').trim());
}

function isDisposableEmail(email) {
  const domain = String(email || '').split('@')[1]?.toLowerCase();
  return Boolean(domain && DISPOSABLE_DOMAINS.has(domain));
}

async function hasMailServer(email) {
  const domain = String(email).split('@')[1];
  if (!domain) return false;
  try {
    const records = await dns.resolveMx(domain);
    return Array.isArray(records) && records.length > 0;
  } catch {
    return false;
  }
}

function generateCode() {
  return String(crypto.randomInt(100000, 1000000));
}

function emailBody(code, lang) {
  const t = {
    uz: {
      subject: 'StatBooks tasdiqlash kodi',
      title: 'Tasdiqlash kodingiz',
      text: 'Hisobingizni tasdiqlash uchun quyidagi kodni kiriting:',
      note: 'Kod 15 daqiqa amal qiladi. Agar siz so‘ramagan bo‘lsangiz, e‘tiborsiz qoldiring.'
    },
    en: {
      subject: 'StatBooks verification code',
      title: 'Your verification code',
      text: 'Enter the code below to verify your account:',
      note: 'The code is valid for 15 minutes. If you did not request it, ignore this email.'
    },
    ru: {
      subject: 'Код подтверждения StatBooks',
      title: 'Ваш код подтверждения',
      text: 'Введите код ниже, чтобы подтвердить аккаунт:',
      note: 'Код действителен 15 минут. Если вы не запрашивали его, проигнорируйте письмо.'
    }
  };
  const m = t[lang] || t.uz;
  const text = `StatBooks\n\n${m.title}\n${m.text}\n\n${code}\n\n${m.note}`;
  const html = `
  <div style="font-family:Georgia,serif;background:#1A1814;color:#F5F0E8;padding:32px;border-radius:16px;max-width:480px;margin:auto">
    <h1 style="color:#E8A94A;font-size:22px;margin:0 0 8px">StatBooks</h1>
    <h2 style="font-size:18px;margin:0 0 16px">${m.title}</h2>
    <p style="color:#C9C1B2;margin:0 0 16px">${m.text}</p>
    <div style="font-size:34px;letter-spacing:8px;font-weight:bold;color:#E8A94A;background:#211E19;padding:16px;text-align:center;border-radius:12px">${code}</div>
    <p style="color:#8A8270;font-size:13px;margin:16px 0 0">${m.note}</p>
  </div>`;
  return { subject: m.subject, html, text };
}

function escapeHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function loginAlertBody(meta = {}, lang = 'uz') {
  const method = meta.method === 'google' ? 'Google' : 'Password';
  const time = meta.at ? new Date(meta.at).toISOString() : new Date().toISOString();
  const ip = escapeHtml(meta.ip || 'unknown');
  const device = escapeHtml(meta.userAgent || 'unknown device');

  const t = {
    uz: {
      subject: 'StatBooks: Hisobingizga kirish amalga oshirildi',
      title: 'Hisobingizga muvaffaqiyatli kirildi',
      text: 'Agar bu siz bo‘lmasangiz, darhol parolingizni almashtiring.',
      method: `Kirish usuli: ${method}`,
      time: `Vaqt: ${time}`,
      ip: `IP: ${ip}`,
      device: `Qurilma: ${device}`
    },
    en: {
      subject: 'StatBooks: New login to your account',
      title: 'Your account was logged in successfully',
      text: 'If this was not you, change your password immediately.',
      method: `Method: ${method}`,
      time: `Time: ${time}`,
      ip: `IP: ${ip}`,
      device: `Device: ${device}`
    },
    ru: {
      subject: 'StatBooks: Вход в ваш аккаунт',
      title: 'В ваш аккаунт выполнен успешный вход',
      text: 'Если это были не вы, срочно смените пароль.',
      method: `Способ входа: ${method}`,
      time: `Время: ${time}`,
      ip: `IP: ${ip}`,
      device: `Устройство: ${device}`
    }
  };

  const m = t[lang] || t.uz;
  const text = `StatBooks\n\n${m.title}\n${m.text}\n\n${m.method}\n${m.time}\n${m.ip}\n${m.device}`;
  const html = `
  <div style="font-family:Georgia,serif;background:#1A1814;color:#F5F0E8;padding:32px;border-radius:16px;max-width:560px;margin:auto">
    <h1 style="color:#E8A94A;font-size:22px;margin:0 0 8px">StatBooks</h1>
    <h2 style="font-size:18px;margin:0 0 12px">${m.title}</h2>
    <p style="color:#C9C1B2;margin:0 0 16px">${m.text}</p>
    <div style="background:#211E19;padding:14px;border-radius:12px;color:#C9C1B2;line-height:1.5">
      <div>${m.method}</div>
      <div>${m.time}</div>
      <div>${m.ip}</div>
      <div>${m.device}</div>
    </div>
  </div>`;
  return { subject: m.subject, html, text };
}

const RESEND_DEFAULT_SENDER = 'StatBooks <onboarding@resend.dev>';

// ─── Gmail SMTP (nodemailer) ───────────────────────────────────────────────
// Fallback when Resend is in testing/sandbox mode.
// Setup: Gmail > Manage account > Security > 2-Step Verification → App passwords
// Set GMAIL_USER and GMAIL_APP_PASSWORD in .env

function gmailTransporter() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return null;
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
    // Fail fast instead of hanging for ~90s. Some hosts (e.g. Render free)
    // block outbound SMTP ports, which otherwise stalls the whole request.
    connectionTimeout: 7000,
    greetingTimeout: 7000,
    socketTimeout: 10000
  });
}

async function sendViaGmail(email, payload) {
  const transporter = gmailTransporter();
  if (!transporter) return false;
  try {
    await transporter.sendMail({
      from: `StatBooks <${process.env.GMAIL_USER}>`,
      to: email,
      subject: payload.subject,
      text: payload.text,
      html: payload.html
    });
    return true;
  } catch (err) {
    console.warn('[email] Gmail SMTP failed:', err.message);
    return false;
  }
}

// ─── Brevo (HTTP API) ──────────────────────────────────────────────────────
// Brevo sends over HTTPS (not SMTP), so it works on hosts that block SMTP
// ports such as Render's free plan. Free tier: 300 emails/day. Setup: create a
// key at brevo.com, verify the sender address, then set BREVO_API_KEY and
// BREVO_SENDER (the verified sender email).
const BREVO_URL = 'https://api.brevo.com/v3/smtp/email';

async function sendViaBrevo(email, payload) {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) return false;
  const senderEmail = process.env.BREVO_SENDER || process.env.GMAIL_USER;
  if (!senderEmail) return false;
  try {
    const res = await fetch(BREVO_URL, {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'content-type': 'application/json',
        accept: 'application/json'
      },
      body: JSON.stringify({
        sender: { name: 'StatBooks', email: senderEmail },
        to: [{ email }],
        subject: payload.subject,
        htmlContent: payload.html,
        textContent: payload.text
      })
    });
    if (res.ok) return true;
    const detail = await res.text().catch(() => '');
    console.warn(`[email] Brevo send failed (${res.status}): ${detail.slice(0, 200)}`);
    return false;
  } catch (err) {
    console.warn('[email] Brevo request failed:', err.message);
    return false;
  }
}

async function postToResend(apiKey, from, email, payload) {
  return fetch(RESEND_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({ from, to: [email], ...payload })
  });
}

/**
 * Detects Resend's "still in test/sandbox mode" responses. Without a verified
 * domain Resend only delivers to the account owner's own address and rejects
 * everything else with a 403 validation_error. We must NOT crash registration
 * in that case — instead we degrade to the dev fallback (log the code) so the
 * verification flow still completes.
 */
function isResendSandboxError(status, detail) {
  if (status === 403) return true;
  const lower = String(detail || '').toLowerCase();
  return (
    lower.includes('verify a domain') ||
    lower.includes('testing emails') ||
    lower.includes('validation_error')
  );
}

function allowDevEmailFallback() {
  return process.env.ALLOW_EMAIL_DEV_FALLBACK === 'true';
}

async function sendVerificationCode(email, code, lang = 'uz') {
  const apiKey = process.env.RESEND_API_KEY;
  const forcedInboxRaw = normalizeEmail(process.env.AUTH_CODE_TEST_INBOX || '');
  const forcedInbox = isValidFormat(forcedInboxRaw) ? forcedInboxRaw : '';
  const recipient = forcedInbox || email;
  const redirected = recipient !== email;
  const { subject, html, text } = emailBody(code, lang);
  const payload = { subject, html, text };

  // Prefer HTTP email providers that work on SMTP-blocked hosts (Render free).
  // Order: Brevo (HTTP, sends to anyone) → Gmail SMTP (local/dev) → Resend.
  if (process.env.BREVO_API_KEY) {
    const brevoOk = await sendViaBrevo(recipient, payload);
    if (brevoOk) {
      console.log(`[email] Brevo sent verification to ${recipient}`);
      return { delivered: true, via: 'brevo', redirected, deliveredTo: recipient };
    }
  }
  if (gmailTransporter()) {
    const gmailOk = await sendViaGmail(recipient, payload);
    if (gmailOk) {
      console.log(`[email] Gmail SMTP sent verification to ${recipient}`);
      return { delivered: true, via: 'gmail', redirected, deliveredTo: recipient };
    }
    // Gmail failed (bad app password, SMTP blocked, etc.) — fall through.
  }

  if (!apiKey) {
    if (!allowDevEmailFallback()) {
      throw new Error('Email provider is not configured. Set RESEND_API_KEY.');
    }
    // Explicit dev fallback only: logs remain enabled when opted in.
    console.log(`[email] (dev) verification code for ${recipient}: ${code}`);
    return { delivered: false, dev: true, redirected, deliveredTo: recipient };
  }

  const from = process.env.EMAIL_FROM || RESEND_DEFAULT_SENDER;
  let res = await postToResend(apiKey, from, recipient, payload);

  // If the custom sender domain isn't verified, retry once with Resend's
  // shared onboarding sender (which works for any verified account).
  if (!res.ok && res.status === 403 && from !== RESEND_DEFAULT_SENDER) {
    const detail = await res.text();
    console.warn(`[email] custom sender "${from}" rejected, retrying with ${RESEND_DEFAULT_SENDER}: ${detail}`);
    res = await postToResend(apiKey, RESEND_DEFAULT_SENDER, recipient, payload);
  }

  if (!res.ok) {
    const detail = await res.text();
    // Account still in Resend's testing/sandbox mode: can only email the
    // account owner. Degrade gracefully so the user can still verify with the
    // code (printed to the server console) instead of seeing a hard error.
    if (isResendSandboxError(res.status, detail)) {
      // Try Gmail SMTP before giving up
      const gmailOk = await sendViaGmail(recipient, payload);
      if (gmailOk) {
        console.log(`[email] Gmail SMTP sent to ${recipient}`);
        return { delivered: true, via: 'gmail', redirected, deliveredTo: recipient };
      }

      if (!allowDevEmailFallback()) {
        throw new Error(
          'Email yetkazib berilmadi. GMAIL_USER va GMAIL_APP_PASSWORD ni .env ga qo\'shing.'
        );
      }
      console.warn(
        `[email] Resend testing mode, Gmail not configured. ` +
          `Dev verification code for ${recipient}: ${code}`
      );
      return { delivered: false, dev: true, restricted: true, redirected, deliveredTo: recipient };
    }
    throw new Error(`Email send failed (${res.status}): ${detail}`);
  }

  const data = await res.json().catch(() => ({}));
  if (data.id) console.log(`[email] verification email queued by Resend: ${data.id}`);
  return { delivered: true, id: data.id, redirected, deliveredTo: recipient };
}

async function sendLoginAlertEmail(email, meta = {}, lang = 'uz') {
  const apiKey = process.env.RESEND_API_KEY;
  const { subject, html, text } = loginAlertBody(meta, lang);
  const payload = { subject, html, text };

  // Prefer HTTP providers first (see sendVerificationCode for rationale).
  if (process.env.BREVO_API_KEY) {
    const brevoOk = await sendViaBrevo(email, payload);
    if (brevoOk) return { delivered: true, via: 'brevo' };
  }
  if (gmailTransporter()) {
    const gmailOk = await sendViaGmail(email, payload);
    if (gmailOk) return { delivered: true, via: 'gmail' };
  }

  if (!apiKey) {
    console.log(`[email] (dev) login alert for ${email}: ${text.replace(/\n+/g, ' | ')}`);
    return { delivered: false, dev: true };
  }

  const from = process.env.EMAIL_FROM || RESEND_DEFAULT_SENDER;
  let res = await postToResend(apiKey, from, email, payload);

  if (!res.ok && res.status === 403 && from !== RESEND_DEFAULT_SENDER) {
    const detail = await res.text();
    console.warn(`[email] custom sender "${from}" rejected for login alert, retrying with ${RESEND_DEFAULT_SENDER}: ${detail}`);
    res = await postToResend(apiKey, RESEND_DEFAULT_SENDER, email, payload);
  }

  if (!res.ok) {
    const detail = await res.text();
    if (isResendSandboxError(res.status, detail)) {
      const gmailOk = await sendViaGmail(email, payload);
      if (gmailOk) return { delivered: true, via: 'gmail' };
    }
    console.warn(`[email] login alert send failed (${res.status}): ${detail}`);
    return { delivered: false, error: detail };
  }

  const data = await res.json().catch(() => ({}));
  if (data.id) console.log(`[email] login alert queued by Resend: ${data.id}`);
  return { delivered: true, id: data.id };
}

module.exports = {
  normalizeEmail,
  isValidFormat,
  isDisposableEmail,
  hasMailServer,
  generateCode,
  sendVerificationCode,
  sendLoginAlertEmail
};
