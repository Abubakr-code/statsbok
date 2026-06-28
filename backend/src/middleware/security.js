const helmet = require('helmet');

// Paths that attackers scan for: config files, admin panels, PHP apps, etc.
const suspiciousPathRe =
  /(?:^|\/)(?:\.env|\.git|\.ssh|phpmyadmin|phpadminpanel|phpadmin|adminer|wp-admin|wp-login|wp-config|database|db|backup|dump|config|shell|eval|xmlrpc|cgi-bin|phpinfo|\.well-known\/acme)(?:\/|$|\.)|\.php$|\.asp$|\.aspx$|\.jsp$/i;

function securityHeaders() {
  return helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    // This is a JSON API — no HTML is served, so a strict CSP prevents
    // responses from being embedded in iframes or used as script sources.
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
    // HSTS: force HTTPS for 1 year (set by helmet by default in prod, we make it explicit)
    strictTransportSecurity: {
      maxAge: 31536000,
      includeSubDomains: true,
    },
    // Prevent MIME-type sniffing
    noSniff: true,
    // Deny iframe embedding
    frameguard: { action: 'deny' },
    // Hide X-Powered-By (also disabled in app.js)
    hidePoweredBy: true,
    // Prevent IE from opening downloads in site context
    ieNoOpen: true,
    // Referrer policy — don't leak URLs to third parties
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    // Disable XSS filter (modern recommendation — CSP is better)
    xssFilter: false,
  });
}

function blockSuspiciousPaths(req, res, next) {
  const path = req.path || '';
  if (suspiciousPathRe.test(path)) {
    return res.status(404).json({ error: 'Not found' });
  }
  return next();
}

// Validate that a route param is a valid MongoDB ObjectId before hitting the DB.
// Returns 400 immediately if invalid — prevents CastErrors and unnecessary queries.
function validateObjectId(paramName = 'id') {
  return (req, res, next) => {
    const value = req.params[paramName] || '';
    if (!/^[a-f\d]{24}$/i.test(value)) {
      return res.status(400).json({ error: 'Invalid ID format' });
    }
    return next();
  };
}

module.exports = { securityHeaders, blockSuspiciousPaths, validateObjectId };
