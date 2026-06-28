const { sendLoginAlertEmail } = require('./emailService');
const { sendLoginAlertSms } = require('./smsService');

function clientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

function compactUserAgent(value) {
  return String(value || 'unknown device')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 220);
}

async function notifySuccessfulLogin(user, req, method = 'password') {
  if (!user) return;

  const meta = {
    method,
    ip: clientIp(req),
    userAgent: compactUserAgent(req.headers['user-agent']),
    at: new Date().toISOString()
  };

  const tasks = [];
  if (user.email) tasks.push(sendLoginAlertEmail(user.email, meta, user.language || 'uz'));
  if (user.phone) tasks.push(sendLoginAlertSms(user.phone, meta, user.language || 'uz'));
  if (tasks.length === 0) return;

  const outcomes = await Promise.allSettled(tasks);
  outcomes.forEach((outcome) => {
    if (outcome.status === 'rejected') {
      console.warn(`[auth-notify] login notification failed: ${outcome.reason?.message || outcome.reason}`);
    }
  });
}

module.exports = { notifySuccessfulLogin };
