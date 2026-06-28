const DEFAULT_FROM = 'StatBooks';

function loginSmsText(meta = {}, lang = 'uz') {
  const method = meta.method === 'google' ? 'Google' : 'Password';
  const time = meta.at ? new Date(meta.at).toISOString() : new Date().toISOString();
  const ip = meta.ip || 'unknown';

  const t = {
    uz: `StatBooks: hisobingizga kirish amalga oshirildi. Usul: ${method}. Vaqt: ${time}. IP: ${ip}. Agar bu siz bo'lmasangiz, parolni almashtiring.`,
    en: `StatBooks: your account was logged in. Method: ${method}. Time: ${time}. IP: ${ip}. If this wasn't you, change password now.`,
    ru: `StatBooks: вход в аккаунт выполнен. Способ: ${method}. Время: ${time}. IP: ${ip}. Если это не вы, смените пароль.`
  };
  return t[lang] || t.uz;
}

function buildSmsPayload(phone, message) {
  const toField = process.env.SMS_TO_FIELD || 'to';
  const messageField = process.env.SMS_MESSAGE_FIELD || 'message';
  const fromField = process.env.SMS_FROM_FIELD || 'from';
  const fromValue = process.env.SMS_FROM || DEFAULT_FROM;

  return {
    [toField]: phone,
    [messageField]: message,
    [fromField]: fromValue
  };
}

function authHeaders() {
  const headers = { 'content-type': 'application/json' };
  const apiKey = process.env.SMS_API_KEY;
  if (!apiKey) return headers;

  const headerName = process.env.SMS_API_KEY_HEADER || 'authorization';
  const prefix = process.env.SMS_API_KEY_PREFIX || 'Bearer ';
  headers[headerName] = `${prefix}${apiKey}`;
  return headers;
}

async function sendSmsMessage(phone, message) {
  const apiUrl = process.env.SMS_API_URL;
  if (!apiUrl) {
    console.log(`[sms] (dev) to ${phone}: ${message}`);
    return { delivered: false, dev: true };
  }

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(buildSmsPayload(phone, message))
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      console.warn(`[sms] send failed (${response.status}): ${detail}`);
      return { delivered: false, error: detail };
    }

    return { delivered: true };
  } catch (err) {
    console.warn(`[sms] send failed: ${err.message}`);
    return { delivered: false, error: err.message };
  }
}

async function sendLoginAlertSms(phone, meta = {}, lang = 'uz') {
  if (!phone) return { delivered: false, skipped: true };
  const message = loginSmsText(meta, lang);
  return sendSmsMessage(phone, message);
}

module.exports = { sendLoginAlertSms };
