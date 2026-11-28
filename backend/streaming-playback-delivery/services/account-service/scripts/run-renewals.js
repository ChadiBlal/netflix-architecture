// Manually run the renewal job once:  npm run renew
// Optional: node scripts/run-renewals.js 2026-12-25   (simulate a future date; handy for demos)
const { pool } = require('../src/db');
const { redis } = require('../src/redis');
const billing = require('../src/services/billing.service');

(async () => {
  const now = process.argv[2] ? new Date(process.argv[2]) : new Date();
  const n = await billing.processRenewals(now);
  console.log(`Processed ${n} subscription(s) as of ${now.toISOString()}`);
  await pool.end();
  redis.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
