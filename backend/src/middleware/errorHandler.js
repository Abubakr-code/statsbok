/**
 * Global error handler. Must be the last middleware mounted in app.js.
 * Sends a JSON error response and avoids leaking stack traces in production.
 */
function errorHandler(err, req, res, next) {
  // eslint-disable-next-line no-unused-vars
  const status = err.statusCode || err.status || 500;
  const isProduction = process.env.NODE_ENV === 'production';

  if (status >= 500) {
    console.error('Unhandled error:', err);
  }

  // 5xx errors: never expose raw error messages in production — they may contain
  // DB schema details, file paths, or internal state. Only use publicMessage
  // (which is set intentionally by our own code) or a generic fallback.
  let message;
  if (status >= 500 && isProduction) {
    message = err.publicMessage || 'Internal server error';
  } else {
    message = err.publicMessage || err.message || 'Internal server error';
  }

  res.status(status).json({
    error: message,
    ...(!isProduction && status >= 500 ? { stack: err.stack } : {}),
  });
}

/**
 * Small helper to create errors with an HTTP status code.
 */
function httpError(status, message) {
  const err = new Error(message);
  err.statusCode = status;
  err.publicMessage = message;
  return err;
}

module.exports = errorHandler;
module.exports.httpError = httpError;
