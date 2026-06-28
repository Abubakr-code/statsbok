const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Read the JWT from the httpOnly cookie (preferred) or the
 * Authorization: Bearer <token> header.
 */
function extractToken(req) {
  if (req.cookies && req.cookies.token) return req.cookies.token;
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7);
  return null;
}

/**
 * Require a valid JWT. Attaches req.user (the User document).
 */
async function requireAuth(req, res, next) {
  try {
    const token = extractToken(req);
    if (!token) return res.status(401).json({ error: 'Authentication required' });

    const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    const user = await User.findById(payload.sub);
    if (!user) return res.status(401).json({ error: 'User no longer exists' });

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Optional auth: attaches req.user if a valid token is present, but never blocks.
 */
async function optionalAuth(req, res, next) {
  try {
    const token = extractToken(req);
    if (token) {
      const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
      const user = await User.findById(payload.sub);
      if (user) req.user = user;
    }
  } catch (err) {
    // ignore - treat as anonymous
  }
  next();
}

module.exports = { requireAuth, optionalAuth };
