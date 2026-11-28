const { randomUUID } = require('crypto');
const { publish } = require('../kafka');
const { HttpError } = require('../utils/errors');

const allowedTypes = new Set(['play', 'pause', 'resume', 'seek', 'progress', 'stop', 'ended', 'heartbeat']);
async function emit({ userId, profileId, videoId, playbackSessionId, type, positionSeconds, durationSeconds, device, occurredAt }) {
  if (!allowedTypes.has(type)) throw new HttpError(400, 'Unsupported event type', 'invalid_event_type');
  const event = {
    eventId: randomUUID(),
    eventType: type,
    userId,
    profileId: profileId || null,
    videoId,
    playbackSessionId,
    positionSeconds: positionSeconds == null ? null : Number(positionSeconds),
    durationSeconds: durationSeconds == null ? null : Number(durationSeconds),
    device: device || 'unknown',
    occurredAt: occurredAt || new Date().toISOString(),
    schemaVersion: 1
  };
  await publish(event);
  return event;
}
module.exports = { emit };
