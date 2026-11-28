const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const config = require('./config');
const { redis } = require('./redis');
const { client: cassandraClient } = require('./cassandra');
const kafka = require('./kafka');
const { notFound, errorHandler } = require('./utils/errors');

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: config.corsOrigins.length ? config.corsOrigins : true, credentials: true }));
app.use(express.json({ limit: '50kb' }));
if (process.env.NODE_ENV !== 'test') app.use(morgan('dev'));

app.get(['/health', '/api/streaming/health'], async (req, res) => {
  const out = { service: 'streaming-playback-service', redis: 'down', kafka: 'unknown', cassandra: 'unknown' };
  try { out.redis = (await redis.ping()) === 'PONG' ? 'up' : 'down'; } catch {}
  try { out.kafka = kafka.isConnected() ? 'up' : 'down'; } catch {}
  try { await cassandraClient.execute('SELECT now() FROM system.local'); out.cassandra = 'up'; } catch {}
  const ok = out.redis === 'up' && out.cassandra === 'up' && out.kafka === 'up';
  res.status(ok ? 200 : 503).json(out);
});

app.use('/api/streaming', require('./routes/streaming.routes'));
app.use(notFound);
app.use(errorHandler);
module.exports = app;
