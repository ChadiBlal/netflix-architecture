// "Is this user allowed to stream, and at what quality?"
// Cached in Redis under  entitlement:<userId>  (JSON). The Playback service may read this key
// directly, or call GET /api/users/me/entitlement.
const config = require('../config');
const cache = require('../redis');
const billing = require('../repositories/billing.repo');
const { addDays } = require('../utils/dates');

const key = (userId) => `entitlement:${userId}`;

async function get(userId) {
  const cached = await cache.get(key(userId));
  if (cached) return { ...JSON.parse(cached), cached: true };

  const sub = await billing.liveSubscription(userId);
  const now = new Date();
  let ent = { entitled: false, status: 'none', plan: null, maxStreams: 0, maxResolution: null, periodEnd: null };
  if (sub) {
    const end = new Date(sub.currentPeriodEnd);
    const entitled =
      (sub.status === 'active' && (!sub.cancelAtPeriodEnd || end > now)) ||
      (sub.status === 'past_due' && now < addDays(end, config.graceDays));
    ent = {
      entitled,
      status: sub.status,
      plan: sub.planCode,
      maxStreams: sub.maxStreams,
      maxResolution: sub.maxResolution,
      periodEnd: sub.currentPeriodEnd,
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
    };
  }
  await cache.set(key(userId), JSON.stringify(ent), config.entitlementCacheSeconds);
  return { ...ent, cached: false };
}

const invalidate = (userId) => cache.del(key(userId));

module.exports = { get, invalidate };
