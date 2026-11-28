class HttpError extends Error {
  constructor(status, message, code = 'error', details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
function notFound(req, res) {
  res.status(404).json({ error: { code: 'not_found', message: 'Route not found' } });
}
function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);
  const status = err.status || 500;
  if (status >= 500) console.error('[streaming-service]', err);
  res.status(status).json({
    error: {
      code: err.code || 'internal_error',
      message: status >= 500 ? 'Internal server error' : err.message,
      ...(err.details ? { details: err.details } : {})
    }
  });
}
module.exports = { HttpError, asyncHandler, notFound, errorHandler };
