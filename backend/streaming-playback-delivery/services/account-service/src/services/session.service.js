// Active sessions live in Redis (see "Redis: Active sessions" in the architecture diagram):
//   session:<userId>:<sid>  ->  JSON { sid, device, ip, createdAt, lastSeenAt }   (TTL = refresh token lifetime)
// Postgres (refresh_tokens.session_id) remains the durable source of truth; if Redis is down,
// sessions are still enforced and can still be listed (without device details).
const config = require('../config');
const cache = require('../redis');
const { tx } = require('../db');
const { HttpError } = require('../utils/errors');
const tokens = require('../repositories/tokens.repo');

const key = (userId, sid) => `session:${userId}:${sid}`;
const ttl = () => config.refreshTtlDays * 86400;

async function create(userId, sid, meta) {
  const now = new Date().toISOString();
  await cache.set(key(userId, sid), JSON.stringify({ sid, device: meta.device, ip: meta.ip, createdAt: now, lastSeenAt: now }), ttl());
}

// Called on every refresh: keeps the Redis entry alive and updates lastSeenAt.
async function touch(userId, sid, meta) {
  const raw = await cache.get(key(userId, sid));
  const s = raw ? JSON.parse(raw) : { sid, createdAt: new Date().toISOString() };
  await cache.set(key(userId, sid), JSON.stringify({ ...s, device: meta.device ?? s.device, ip: meta.ip ?? s.ip, lastSeenAt: new Date().toISOString() }), ttl());
}

async function list(userId, currentSid) {
  const found = [];
  try {
    const { redis } = cache;
    let cursor = '0';
    do {
      const [next, keys] = await redis.scan(cursor, 'MATCH', `session:${userId}:*`, 'COUNT', 100);
      cursor = next;
      if (keys.length) for (const raw of await redis.mget(keys)) if (raw) found.push(JSON.parse(raw));
    } while (cursor !== '0');
  } catch { /* Redis down: fall back to Postgres below */ }

  // Postgres is authoritative for which sessions are alive.
  const alive = new Map((await tokens.activeSessions(userId)).map((r) => [r.sessionId, r]));
  const out = found.filter((s) => alive.has(s.sid));
  for (const [sid, r] of alive) if (!out.some((s) => s.sid === sid)) out.push({ sid, createdAt: r.createdAt });
  return out
    .map((s) => ({ ...s, current: s.sid === currentSid }))
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
}

// Kills a session: refresh tokens revoked, Redis entry removed, and its access tokens denylisted.
async function revoke(userId, sid) {
  await tx((c) => tokens.revokeSession(userId, sid, c));
  await cache.del(key(userId, sid));
  await cache.set(`deny:sid:${sid}`, '1', config.accessTtlSeconds);
}

async function revokeOne(userId, sid) {
  if (!(await list(userId)).some((s) => s.sid === sid)) throw new HttpError(404, 'Session not found', 'not_found');
  await revoke(userId, sid);
}

async function revokeAll(userId, exceptSid) {
  for (const s of await list(userId, exceptSid)) if (s.sid !== exceptSid) await revoke(userId, s.sid);
}

module.exports = { create, touch, list, revoke, revokeOne, revokeAll };
