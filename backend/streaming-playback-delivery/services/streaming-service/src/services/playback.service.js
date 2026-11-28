const { randomUUID } = require('crypto');
const config = require('../config');
const { redis } = require('../redis');
const { HttpError } = require('../utils/errors');
const entitlementService = require('./entitlement.service');
const events = require('./event.service');

const sessionKey = id => `playback:session:${id}`;
const activeKey = userId => `playback:active:${userId}`;
const continueKey = userId => `continue-watching:${userId}`;
const START_SCRIPT = `
  local key = KEYS[1]
  local now = tonumber(ARGV[1])
  local max = tonumber(ARGV[2])
  local sessionId = ARGV[3]
  local expires = tonumber(ARGV[4])
  redis.call('ZREMRANGEBYSCORE', key, '-inf', now)
  if redis.call('ZSCORE', key, sessionId) then
    redis.call('ZADD', key, expires, sessionId)
    redis.call('EXPIRE', key, ARGV[5])
    return 1
  end
  if redis.call('ZCARD', key) >= max then return 0 end
  redis.call('ZADD', key, expires, sessionId)
  redis.call('EXPIRE', key, ARGV[5])
  return 1
`;

async function start(user, accessToken, input, device) {
  await entitlementService.validateProfile(input.profileId, accessToken);
  const entitlement = await entitlementService.get(user.id, accessToken);
  if (!entitlement.entitled) throw new HttpError(403, 'An active subscription is required to play videos', 'subscription_required');
  const maxStreams = Number(entitlement.maxStreams || 0);
  if (maxStreams < 1) throw new HttpError(403, 'Your subscription does not allow streaming', 'streaming_not_allowed');

  const playbackSessionId = randomUUID();
  const now = Date.now();
  const expires = now + config.playbackSessionTtlSeconds * 1000;
  const result = await redis.eval(
    START_SCRIPT, 1, activeKey(user.id), now, maxStreams,
    playbackSessionId, expires, config.playbackSessionTtlSeconds
  );
  if (Number(result) !== 1) {
    throw new HttpError(429, `Your plan allows ${maxStreams} simultaneous stream(s)`, 'stream_limit_reached');
  }

  const session = {
    playbackSessionId, userId: user.id, profileId: input.profileId || null,
    videoId: input.videoId, positionSeconds: 0, durationSeconds: input.durationSeconds || null,
    startedAt: new Date().toISOString(), lastSeenAt: new Date().toISOString(), device: device || 'unknown'
  };
  try {
    await redis.set(sessionKey(playbackSessionId), JSON.stringify(session), 'EX', config.playbackSessionTtlSeconds);
    await events.emit({ ...session, type: 'play' });
  } catch (err) {
    await redis.zrem(activeKey(user.id), playbackSessionId).catch(() => {});
    await redis.del(sessionKey(playbackSessionId)).catch(() => {});
    throw err;
  }
  return { session, entitlement: { plan: entitlement.plan, maxStreams, maxResolution: entitlement.maxResolution } };
}

async function getOwnedSession(userId, playbackSessionId) {
  const raw = await redis.get(sessionKey(playbackSessionId));
  if (!raw) throw new HttpError(404, 'Playback session not found or expired', 'playback_session_not_found');
  const session = JSON.parse(raw);
  if (session.userId !== userId) throw new HttpError(404, 'Playback session not found', 'playback_session_not_found');
  return session;
}

async function touch(userId, playbackSessionId) {
  const session = await getOwnedSession(userId, playbackSessionId);
  const now = Date.now();
  await redis.zadd(activeKey(userId), now + config.playbackSessionTtlSeconds * 1000, playbackSessionId);
  await redis.expire(activeKey(userId), config.playbackSessionTtlSeconds);
  session.lastSeenAt = new Date(now).toISOString();
  await redis.set(sessionKey(playbackSessionId), JSON.stringify(session), 'EX', config.playbackSessionTtlSeconds);
  return session;
}

async function progress(userId, playbackSessionId, input) {
  const session = await touch(userId, playbackSessionId);
  const now = Date.now();
  const last = session.lastProgressAt ? new Date(session.lastProgressAt).getTime() : 0;
  if (now - last < config.progressMinIntervalSeconds * 1000 && input.type === 'progress') {
    return { accepted: false, throttled: true, session };
  }
  const updated = {
    ...session,
    positionSeconds: input.positionSeconds,
    durationSeconds: input.durationSeconds ?? session.durationSeconds,
    lastProgressAt: new Date(now).toISOString()
  };
  await redis.set(sessionKey(playbackSessionId), JSON.stringify(updated), 'EX', config.playbackSessionTtlSeconds);
  const item = {
    playbackSessionId, userId, profileId: session.profileId, videoId: session.videoId,
    positionSeconds: input.positionSeconds, durationSeconds: input.durationSeconds ?? session.durationSeconds,
    updatedAt: updated.lastProgressAt
  };
  await redis.hset(continueKey(userId), session.videoId, JSON.stringify(item));
  await redis.expire(continueKey(userId), 60 * 60 * 24 * 30);
  const event = await events.emit({
    ...session, type: input.type || 'progress',
    positionSeconds: input.positionSeconds,
    durationSeconds: input.durationSeconds ?? session.durationSeconds
  });
  return { accepted: true, session: updated, eventId: event.eventId };
}

async function activity(userId, playbackSessionId, input) {
  const session = await touch(userId, playbackSessionId);
  const event = await events.emit({
    ...session, type: input.type,
    positionSeconds: input.positionSeconds ?? session.positionSeconds,
    durationSeconds: input.durationSeconds ?? session.durationSeconds
  });
  return { eventId: event.eventId, accepted: true };
}

async function stop(userId, playbackSessionId, input = {}) {
  const session = await getOwnedSession(userId, playbackSessionId);
  if (input.ended) {
    await redis.hdel(continueKey(userId), session.videoId);
  } else if (Number.isFinite(input.positionSeconds)) {
    const item = {
      playbackSessionId, userId, profileId: session.profileId, videoId: session.videoId,
      positionSeconds: input.positionSeconds, durationSeconds: input.durationSeconds ?? session.durationSeconds,
      updatedAt: new Date().toISOString()
    };
    await redis.hset(continueKey(userId), session.videoId, JSON.stringify(item));
  }
  await events.emit({
    ...session, type: input.ended ? 'ended' : 'stop',
    positionSeconds: input.positionSeconds ?? session.positionSeconds,
    durationSeconds: input.durationSeconds ?? session.durationSeconds
  });
  await redis.zrem(activeKey(userId), playbackSessionId);
  await redis.del(sessionKey(playbackSessionId));
  return { stopped: true };
}

async function listContinueWatching(userId) {
  const values = await redis.hvals(continueKey(userId));
  return values.map(v => JSON.parse(v)).sort((a,b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}
module.exports = { start, getOwnedSession, progress, activity, stop, listContinueWatching };
