const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const config = require('./config');
const { pool } = require('./db');
const { redis } = require('./redis');
const { notFound, errorHandler } = require('./middleware/error');

const app = express();
app.set('trust proxy', 1); // we sit behind the Zuul gateway
app.disable('x-powered-by');

app.use(helmet());
app.use(cors({ origin: config.corsOrigins.length ? config.corsOrigins : true, credentials: true }));
app.use(express.json({ limit: '50kb' }));
if (process.env.NODE_ENV !== 'test') app.use(morgan('dev'));

// Health (reachable through Zuul because unknown paths are sent to this service).
app.get(['/health', '/api/users/health'], async (req, res) => {
  const out = { service: 'account-service', postgres: 'down', redis: 'down' };
  try { await pool.query('SELECT 1'); out.postgres = 'up'; } catch { /* reported below */ }
  try { out.redis = (await redis.ping()) === 'PONG' ? 'up' : 'down'; } catch { /* reported below */ }
  res.status(out.postgres === 'up' ? 200 : 503).json(out); // Redis is optional (cache)
});

// Billing is registered first so /plans and /me/subscription... resolve before the generic routes.
app.use('/api/users', require('./routes/billing.routes'));
app.use('/api/users', require('./routes/users.routes'));

app.use(notFound);
app.use(errorHandler);

module.exports = app;
