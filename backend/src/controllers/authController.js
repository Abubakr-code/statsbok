const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const {
  normalizeEmail,
  isValidFormat,
  isDisposableEmail,
  hasMailServer,
  generateCode,
  sendVerificationCode
} = require('../services/emailService');
const { notifySuccessfulLogin } = require('../services/authNotificationService');

const COOKIE_NAME = 'token';
const CODE_TTL_MS = 15 * 60 * 1000;

// Demo mode: when no email provider can deliver codes (e.g. on a host that
// blocks SMTP and without a verified email domain), skip the email code and
// sign the user in immediately on registration. Flip SKIP_EMAIL_VERIFICATION
// back to false once a working email sender is configured.
const SKIP_EMAIL_VERIFICATION = process.env.SKIP_EMAIL_VERIFICATION === 'true';

function cookieOptions() {
  const week = 7 * 24 * 60 * 60 * 1000;
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    maxAge: week
  };
}

function signToken(user) {
  return jwt.sign({ sub: user._id.toString() }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });
}

function publicUser(user) {
  return {
    id: user._id,
    email: user.email || null,
    phone: user.phone || null,
    name: user.name,
    avatarUrl: user.avatarUrl || null,
    bio: user.bio || '',
    plan: user.plan,
    premiumUntil: user.premiumUntil,
    language: user.language,
    savedLimit: user.savedLimit,
    verified: user.verified,
    isBlogger: user.isBlogger || false,
    bloggerProfile: user.bloggerProfile || {}
  };
}

// Signup/login currently uses email verification only.
function resolveIdentity(body) {
  if (body.email) return { field: 'email', value: normalizeEmail(body.email) };
  return null;
}

// Generate a fresh code, store its hash + expiry, and deliver it by email.
async function issueCode(user, lang) {
  const code = generateCode();
  user.verificationCodeHash = await bcrypt.hash(code, 10);
  user.verificationExpires = new Date(Date.now() + CODE_TTL_MS);
  await user.save();
  return sendVerificationCode(user.email, code, lang || user.language);
}

function isVerifiedGoogleEmail(value) {
  return value === true || value === 'true' || value === '1' || value === 1;
}

async function verifyGoogleIdToken(credential) {
  const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
  if (!response.ok) {
    return null;
  }
  const payload = await response.json();
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    throw Object.assign(new Error('GOOGLE_CLIENT_ID is not configured on the server'), { status: 500 });
  }
  if (payload.aud !== clientId) {
    throw Object.assign(new Error('Google token audience mismatch'), { status: 401 });
  }
  if (!payload.email || !isVerifiedGoogleEmail(payload.email_verified)) {
    throw Object.assign(new Error('Google email not verified'), { status: 401 });
  }
  return payload;
}

async function verifyGoogleAccessToken(accessToken) {
  const tokenInfoResponse = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(accessToken)}`
  );
  if (!tokenInfoResponse.ok) {
    return null;
  }

  const tokenInfo = await tokenInfoResponse.json();
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    throw Object.assign(new Error('GOOGLE_CLIENT_ID is not configured on the server'), { status: 500 });
  }
  // Access tokens: aud = resource server, azp = authorized party (OAuth client ID)
  if (tokenInfo.azp !== clientId && tokenInfo.aud !== clientId) {
    throw Object.assign(new Error('Google access token audience mismatch'), { status: 401 });
  }
  if (!tokenInfo.email || !isVerifiedGoogleEmail(tokenInfo.email_verified)) {
    throw Object.assign(new Error('Google email not verified'), { status: 401 });
  }

  let userInfo = null;
  try {
    const userInfoResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { authorization: `Bearer ${accessToken}` }
    });
    if (userInfoResponse.ok) {
      userInfo = await userInfoResponse.json();
    }
  } catch {
    // Best-effort enrichment only.
  }

  return {
    sub: tokenInfo.sub || userInfo?.sub,
    email: tokenInfo.email || userInfo?.email,
    email_verified: tokenInfo.email_verified || userInfo?.email_verified,
    name: userInfo?.name || tokenInfo.name || '',
    picture: userInfo?.picture || null
  };
}

async function register(req, res, next) {
  try {
    const { password, name, language } = req.body;
    const identity = resolveIdentity(req.body);
    if (!identity) return res.status(400).json({ error: 'Email is required' });

    // Hard caps to prevent ReDoS and oversized payloads from reaching bcrypt/DNS.
    const rawEmail = String(req.body.email || '');
    if (rawEmail.length > 254) return res.status(400).json({ error: 'Invalid email address' });
    if (!password || String(password).length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    if (String(password).length > 128) {
      return res.status(400).json({ error: 'Password too long' });
    }
    if (name && String(name).length > 100) {
      return res.status(400).json({ error: 'Name too long' });
    }

    // Validate the identifier.
    if (identity.field === 'email') {
      if (!isValidFormat(identity.value)) {
        return res.status(400).json({ error: 'Invalid email address' });
      }
      if (isDisposableEmail(identity.value)) {
        return res.status(400).json({ error: 'Temporary email addresses are not allowed' });
      }
      if (!(await hasMailServer(identity.value))) {
        return res.status(400).json({ error: 'This email domain cannot receive mail' });
      }
    }

    const existing = await User.findOne({ [identity.field]: identity.value });
    if (existing && existing.verified) {
      return res.status(409).json({ error: 'Account already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    let user = existing;
    if (user) {
      user.passwordHash = passwordHash;
      user.name = name || user.name || '';
      user.language = language || user.language || 'uz';
    } else {
      user = new User({
        [identity.field]: identity.value,
        passwordHash,
        name: name || '',
        language: language || 'uz',
        verified: false
      });
    }

    // Demo mode: no email code — verify and sign the user in right away.
    if (SKIP_EMAIL_VERIFICATION) {
      user.verified = true;
      user.verificationCodeHash = null;
      user.verificationExpires = null;
      await user.save();
      const token = signToken(user);
      res.cookie(COOKIE_NAME, token, cookieOptions());
      notifySuccessfulLogin(user, req, 'email_signup').catch(() => {});
      return res.status(201).json({ user: publicUser(user), verified: true });
    }

    const result = await issueCode(user, language);
    res.status(201).json({
      needsVerification: true,
      channel: identity.field,
      [identity.field]: identity.value,
      dev: Boolean(result.dev),
      restricted: Boolean(result.restricted),
      redirected: Boolean(result.redirected),
      deliveredTo: result.deliveredTo || identity.value
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'Account already registered' });
    }
    next(err);
  }
}

async function verify(req, res, next) {
  try {
    const { code } = req.body;
    const identity = resolveIdentity(req.body);
    if (!identity || !code) {
      return res.status(400).json({ error: 'Email and code are required' });
    }
    const user = await User.findOne({ [identity.field]: identity.value });
    if (!user || !user.verificationCodeHash) {
      return res.status(400).json({ error: 'No pending verification' });
    }
    if (!user.verificationExpires || user.verificationExpires < new Date()) {
      return res.status(400).json({ error: 'Code expired. Request a new one.' });
    }
    const ok = await bcrypt.compare(String(code), user.verificationCodeHash);
    if (!ok) return res.status(400).json({ error: 'Invalid code' });

    user.verified = true;
    user.verificationCodeHash = null;
    user.verificationExpires = null;
    await user.save();

    const token = signToken(user);
    res.cookie(COOKIE_NAME, token, cookieOptions());
    notifySuccessfulLogin(user, req, 'email_code').catch(() => {});
    res.json({ user: publicUser(user) });
  } catch (err) {
    next(err);
  }
}

async function resendCode(req, res, next) {
  try {
    const { language } = req.body;
    const identity = resolveIdentity(req.body);
    if (!identity) return res.status(400).json({ error: 'Email is required' });
    const user = await User.findOne({ [identity.field]: identity.value });
    if (!user) return res.status(404).json({ error: 'Account not found' });
    if (user.verified) return res.status(400).json({ error: 'Already verified' });
    const result = await issueCode(user, language);
    res.json({
      ok: true,
      dev: Boolean(result.dev),
      restricted: Boolean(result.restricted),
      redirected: Boolean(result.redirected),
      deliveredTo: result.deliveredTo || identity.value
    });
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const { password } = req.body;
    const identity = resolveIdentity(req.body);
    if (!identity || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await User.findOne({ [identity.field]: identity.value });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    if (!user.verified) {
      const result = await issueCode(user);
      return res.status(403).json({
        needsVerification: true,
        channel: identity.field,
        [identity.field]: identity.value,
        dev: Boolean(result?.dev),
        restricted: Boolean(result?.restricted),
        redirected: Boolean(result?.redirected),
        deliveredTo: result?.deliveredTo || identity.value
      });
    }

    const token = signToken(user);
    res.cookie(COOKIE_NAME, token, cookieOptions());
    notifySuccessfulLogin(user, req, 'password').catch(() => {});
    res.json({ user: publicUser(user) });
  } catch (err) {
    next(err);
  }
}

// Step 1 of password reset: send a code to the user's email.
async function forgotPassword(req, res, next) {
  try {
    const { language } = req.body;
    const identity = resolveIdentity(req.body);
    if (!identity) return res.status(400).json({ error: 'Email is required' });

    const user = await User.findOne({ [identity.field]: identity.value });
    // Always return ok to avoid leaking which accounts exist.
    if (user) await issueCode(user, language);
    res.json({ ok: true, channel: identity.field });
  } catch (err) {
    next(err);
  }
}

// Step 2 of password reset: verify the code and set a new password.
async function resetPassword(req, res, next) {
  try {
    const { code, newPassword } = req.body;
    const identity = resolveIdentity(req.body);
    if (!identity || !code || !newPassword) {
      return res.status(400).json({ error: 'Email, code and new password are required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    const user = await User.findOne({ [identity.field]: identity.value });
    if (!user || !user.verificationCodeHash) {
      return res.status(400).json({ error: 'No reset request found' });
    }
    if (!user.verificationExpires || user.verificationExpires < new Date()) {
      return res.status(400).json({ error: 'Code expired. Request a new one.' });
    }
    const ok = await bcrypt.compare(String(code), user.verificationCodeHash);
    if (!ok) return res.status(400).json({ error: 'Invalid code' });

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    user.verified = true;
    user.verificationCodeHash = null;
    user.verificationExpires = null;
    await user.save();

    const token = signToken(user);
    res.cookie(COOKIE_NAME, token, cookieOptions());
    notifySuccessfulLogin(user, req, 'password_reset').catch(() => {});
    res.json({ user: publicUser(user) });
  } catch (err) {
    next(err);
  }
}

async function googleLogin(req, res, next) {
  try {
    const { credential, accessToken } = req.body;
    if (!credential && !accessToken) {
      return res.status(400).json({ error: 'Missing Google credential' });
    }

    let payload = null;
    if (credential) {
      payload = await verifyGoogleIdToken(credential);
      if (!payload) return res.status(401).json({ error: 'Invalid Google token' });
    } else {
      payload = await verifyGoogleAccessToken(accessToken);
      if (!payload) return res.status(401).json({ error: 'Invalid Google access token' });
    }

    const email = normalizeEmail(payload.email);
    if (isDisposableEmail(email)) {
      return res.status(400).json({ error: 'Temporary email addresses are not allowed' });
    }
    let user = await User.findOne({ $or: [{ googleId: payload.sub }, { email }] });
    if (!user) {
      const randomHash = await bcrypt.hash(`google:${payload.sub}:${Date.now()}`, 10);
      user = new User({
        email,
        googleId: payload.sub,
        passwordHash: randomHash,
        name: payload.name || '',
        avatarUrl: payload.picture || null,
        verified: true,
        language: 'uz'
      });
    } else if (!user.googleId) {
      user.googleId = payload.sub;
      user.verified = true;
      if (!user.avatarUrl && payload.picture) user.avatarUrl = payload.picture;
    }
    await user.save();

    const token = signToken(user);
    res.cookie(COOKIE_NAME, token, cookieOptions());
    notifySuccessfulLogin(user, req, 'google').catch(() => {});
    res.json({ user: publicUser(user) });
  } catch (err) {
    if (err.status === 401) {
      return res.status(401).json({ error: err.message || 'Invalid Google token' });
    }
    next(err);
  }
}

async function logout(req, res) {
  res.clearCookie(COOKIE_NAME, cookieOptions());
  res.json({ ok: true });
}

async function me(req, res) {
  res.json({ user: publicUser(req.user) });
}

async function googleClientId(req, res) {
  res.json({ clientId: process.env.GOOGLE_CLIENT_ID || null });
}

module.exports = {
  register,
  verify,
  resendCode,
  login,
  logout,
  me,
  forgotPassword,
  resetPassword,
  googleLogin,
  googleClientId,
  publicUser
};
