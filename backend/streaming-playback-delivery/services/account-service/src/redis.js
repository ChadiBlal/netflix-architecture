const Redis = require('ioredis');
const config = require('./config');

// Redis is a cache here: every helper fails OPEN (errors are logged, never thrown),
// so the service keeps working if Redis is down.
const redis = new Redis(config.redisUrl, {
  maxRetriesPerRequest: 1,
  enableOfflineQueue: false,
  retryStrategy: (n) => Math.min(n * 500, 5000),
});
let warned = false;
redis.on('error', (e) => {
  if (!warned) console.warn('[redis] unavailable, running without cache:', e.message);
  warned = true;
});
redis.on('ready', () => { warned = false; console.log('[redis] connected'); });

const safe = (fn, fallback = null) => async (...args) => {
  try { return await fn(...args); } catch { return fallback; }
};

module.exports = {
  redis,
  get: safe((k) => redis.get(k)),
  set: safe((k, v, ttl) => redis.set(k, v, 'EX', ttl)),
  del: safe((k) => redis.del(k)),
};
