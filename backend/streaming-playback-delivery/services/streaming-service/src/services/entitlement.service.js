const config = require('../config');
const { redis } = require('../redis');
const { HttpError } = require('../utils/errors');

async function get(userId, accessToken) {
  const key = `entitlement:${userId}`;
  const cached = await redis.get(key);
  if (cached) {
    try { return JSON.parse(cached); } catch { await redis.del(key); }
  }

  // Account Service remains the authority. This fallback populates the shared cache.
  const base = process.env.ACCOUNT_SERVICE_URL || 'http://localhost:5001';
  const response = await fetch(`${base}/api/users/me/entitlement`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(5000)
  });
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) throw new HttpError(response.status, 'Account authorization failed', 'account_service_rejected');
    throw new HttpError(503, 'Could not verify subscription entitlement', 'entitlement_unavailable');
  }
  const body = await response.json();
  const entitlement = body.entitlement;
  if (!entitlement) throw new HttpError(503, 'Account Service returned no entitlement', 'invalid_entitlement_response');
  await redis.set(key, JSON.stringify(entitlement), 'EX', 60);
  return entitlement;
}

async function validateProfile(profileId, accessToken) {
  if (!profileId) return;
  const base = process.env.ACCOUNT_SERVICE_URL || 'http://localhost:5001';
  const response = await fetch(`${base}/api/users/me/profiles`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(5000)
  });
  if (!response.ok) throw new HttpError(503, 'Could not validate the selected profile', 'profile_validation_unavailable');
  const body = await response.json();
  if (!(body.profiles || []).some(profile => profile.id === profileId)) {
    throw new HttpError(404, 'Profile does not belong to this account', 'profile_not_found');
  }
}
module.exports = { get, validateProfile };
