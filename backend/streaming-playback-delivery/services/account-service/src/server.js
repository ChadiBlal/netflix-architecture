const config = require('./config');
const app = require('./app');
const { pool } = require('./db');
const { redis } = require('./redis');
const billing = require('./services/billing.service');
const tokens = require('./repositories/tokens.repo');

const server = app.listen(config.port, () => {
  console.log(`[account-service] listening on :${config.port}`);
});

// Background worker: renews / expires subscriptions and cleans old refresh tokens.
let timer;
if (config.runRenewalWorker) {
  let running = false;
  timer = setInterval(async () => {
    if (running) return;
    running = true;
    try {
      const n = await billing.processRenewals();
      if (n) console.log(`[renewals] processed ${n} subscription(s)`);
      await tokens.purgeExpired();
    } catch (e) {
      console.error('[renewals] failed:', e.message);
    } finally {
      running = false;
    }
  }, config.renewalIntervalMs);
}

async function shutdown() {
  console.log('[account-service] shutting down');
  clearInterval(timer);
  server.close(async () => {
    await pool.end().catch(() => {});
    redis.disconnect();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
