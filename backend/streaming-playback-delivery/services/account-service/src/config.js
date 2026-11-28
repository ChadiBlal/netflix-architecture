require('dotenv').config();

const env = process.env;
const isProd = env.NODE_ENV === 'production';

if (isProd && !env.JWT_SECRET) {
  throw new Error('JWT_SECRET must be set in production');
}

module.exports = {
  isProd,
  port: Number(env.PORT || 5001),
  databaseUrl: env.DATABASE_URL || 'postgres://postgres:netflix123@localhost:5432/netflix',
  redisUrl: env.REDIS_URL || 'redis://localhost:6379',
  jwtSecret: env.JWT_SECRET || 'dev-only-secret-change-me',
  accessTtlSeconds: Number(env.ACCESS_TOKEN_TTL_SECONDS || 900),
  refreshTtlDays: Number(env.REFRESH_TOKEN_TTL_DAYS || 30),
  graceDays: Number(env.PAST_DUE_GRACE_DAYS || 7),
  runRenewalWorker: env.RUN_RENEWAL_WORKER !== 'false',
  renewalIntervalMs: Number(env.RENEWAL_INTERVAL_MS || 60000),
  corsOrigins: (env.CORS_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean),
  maxProfiles: 5,
  entitlementCacheSeconds: 60,
};
