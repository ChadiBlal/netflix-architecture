const { ZodError } = require('zod');
const { HttpError } = require('../utils/errors');
const config = require('../config');

const notFound = (req, res) =>
  res.status(404).json({ error: { code: 'not_found', message: `No route for ${req.method} ${req.originalUrl}` } });

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: {
        code: 'validation_error',
        message: 'Invalid request',
        details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      },
    });
  }
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { code: 'bad_json', message: 'Malformed JSON body' } });
  }
  console.error('[error]', err);
  res.status(500).json({ error: { code: 'internal_error', message: config.isProd ? 'Internal server error' : err.message } });
};

module.exports = { notFound, errorHandler };
