const Redis = require('ioredis');
const config = require('./config');
const redis = new Redis(config.redisUrl, {
  maxRetriesPerRequest: 1,
  enableOfflineQueue: false,
  retryStrategy: n => Math.min(n * 500, 5000)
});
let warned = false;
redis.on('error', e => {
  if (!warned) console.warn('[redis] unavailable:', e.message);
  warned = true;
});
redis.on('ready', () => { warned = false; console.log('[redis] connected'); });
module.exports = { redis };
