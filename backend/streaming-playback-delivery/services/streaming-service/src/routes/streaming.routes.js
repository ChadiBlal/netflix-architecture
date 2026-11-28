const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const { z } = require('zod');
const { requireAuth } = require('../middleware/auth');
const { asyncHandler, HttpError } = require('../utils/errors');
const playback = require('../services/playback.service');
const cassandra = require('../cassandra');
const config = require('../config');
const path = require('path');
const fs = require('fs');
const { createReadStream, statSync } = fs;

const id = z.string().min(1).max(120).regex(/^[a-zA-Z0-9_-]+$/);
const startSchema = z.object({
  videoId: id,
  profileId: z.string().uuid().optional(),
  durationSeconds: z.number().int().positive().max(24 * 60 * 60).optional()
});
const progressSchema = z.object({
  positionSeconds: z.number().finite().min(0).max(24 * 60 * 60),
  durationSeconds: z.number().finite().positive().max(24 * 60 * 60).optional(),
  type: z.enum(['progress', 'pause', 'resume', 'seek', 'heartbeat']).default('progress')
});
const activitySchema = z.object({
  type: z.enum(['play', 'pause', 'resume', 'seek', 'heartbeat']),
  positionSeconds: z.number().finite().min(0).optional(),
  durationSeconds: z.number().finite().positive().optional()
});
const stopSchema = z.object({
  positionSeconds: z.number().finite().min(0).optional(),
  durationSeconds: z.number().finite().positive().optional(),
  ended: z.boolean().default(false)
});
const historyQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(30),
  offset: z.coerce.number().int().min(0).max(10000).default(0)
});
const limiter = rateLimit({ windowMs: 60_000, limit: 300, standardHeaders: 'draft-7', legacyHeaders: false });

router.use(limiter, requireAuth);

router.post('/playback/sessions', asyncHandler(async (req, res) => {
  const input = startSchema.parse(req.body);
  const token = req.headers.authorization.slice(7);
  const device = (req.headers['user-agent'] || 'unknown').slice(0, 200);
  const result = await playback.start(req.user, token, input, device);
  res.status(201).json(result);
}));

router.post('/playback/sessions/:sessionId/progress', asyncHandler(async (req, res) => {
  const input = progressSchema.parse(req.body);
  res.json(await playback.progress(req.user.id, req.params.sessionId, input));
}));

router.post('/playback/sessions/:sessionId/activity', asyncHandler(async (req, res) => {
  const input = activitySchema.parse(req.body);
  res.status(202).json(await playback.activity(req.user.id, req.params.sessionId, input));
}));

router.post('/playback/sessions/:sessionId/stop', asyncHandler(async (req, res) => {
  res.json(await playback.stop(req.user.id, req.params.sessionId, stopSchema.parse(req.body || {})));
}));

router.get('/playback/continue-watching', asyncHandler(async (req, res) => {
  res.json({ items: await playback.listContinueWatching(req.user.id) });
}));

// Cassandra is populated asynchronously by the Flink pipeline from Kafka playback.events.
router.get('/playback/history', asyncHandler(async (req, res) => {
  const { limit, offset } = historyQuery.parse(req.query);
  if (offset !== 0) throw new HttpError(400, 'Cassandra history uses cursor pagination; offset is not supported', 'offset_not_supported');
  const month = req.query.month ? String(req.query.month) : new Date().toISOString().slice(0, 7);
  if (!/^\\d{4}-\\d{2}$/.test(month)) throw new HttpError(400, 'month must use YYYY-MM format', 'invalid_month');
  const result = await cassandra.query(
    'SELECT event_id, video_id, profile_id, event_type, position_seconds, duration_seconds, device, occurred_at FROM playback_events_by_user_month WHERE user_id = ? AND month_bucket = ? LIMIT ?',
    [req.user.id, month, limit]
  );
  res.json({ items: result.rows, month, limit });
}));

// Protected media delivery. Put files under MEDIA_ROOT/<videoId>/.
// Supports MP4 byte ranges and HLS manifest/segment requests.
router.get('/videos/:videoId/stream', asyncHandler(async (req, res) => {
  const videoId = id.parse(req.params.videoId);
  const sessionId = z.string().uuid().parse(req.query.sessionId);
  const session = await playback.getOwnedSession(req.user.id, sessionId);
  if (session.videoId !== videoId) throw new HttpError(403, 'Playback session does not match this video', 'video_session_mismatch');
  await playback.activity(req.user.id, sessionId, { type: 'heartbeat', positionSeconds: session.positionSeconds });
  const filePath = path.join(config.mediaRoot, videoId, 'video.mp4');
  return sendMedia(filePath, req, res);
}));

router.get('/videos/:videoId/hls/*', asyncHandler(async (req, res) => {
  const videoId = id.parse(req.params.videoId);
  const sessionId = z.string().uuid().parse(req.query.sessionId);
  const session = await playback.getOwnedSession(req.user.id, sessionId);
  if (session.videoId !== videoId) throw new HttpError(403, 'Playback session does not match this video', 'video_session_mismatch');
  const requested = req.params[0] || 'index.m3u8';
  const resolved = path.resolve(config.mediaRoot, videoId, requested);
  const allowedRoot = path.resolve(config.mediaRoot, videoId) + path.sep;
  if (!resolved.startsWith(allowedRoot) && resolved !== path.resolve(config.mediaRoot, videoId, 'index.m3u8')) {
    throw new HttpError(400, 'Invalid media path', 'invalid_media_path');
  }
  return sendMedia(resolved, req, res);
}));

function sendMedia(filePath, req, res) {
  if (!fs.existsSync(filePath) || !statSync(filePath).isFile()) {
    throw new HttpError(404, 'Media asset not found. Add the video to the configured media directory.', 'media_not_found');
  }
  const stat = statSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const types = { '.mp4': 'video/mp4', '.m3u8': 'application/vnd.apple.mpegurl', '.ts': 'video/mp2t', '.m4s': 'video/iso.segment', '.aac': 'audio/aac', '.key': 'application/octet-stream' };
  res.setHeader('Content-Type', types[ext] || 'application/octet-stream');
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Cache-Control', 'private, max-age=60');
  const range = req.headers.range;
  if (!range || ext === '.m3u8') {
    res.setHeader('Content-Length', stat.size);
    return createReadStream(filePath).pipe(res);
  }
  const match = /^bytes=(\\d*)-(\\d*)$/.exec(range);
  if (!match) { res.status(416).setHeader('Content-Range', `bytes */${stat.size}`).end(); return; }
  let start = match[1] ? Number(match[1]) : 0;
  let end = match[1] ? (match[2] ? Number(match[2]) : stat.size - 1) : stat.size - 1;
  if (!match[1] && match[2]) start = Math.max(0, stat.size - Number(match[2]));
  if (start >= stat.size || end < start) { res.status(416).setHeader('Content-Range', `bytes */${stat.size}`).end(); return; }
  end = Math.min(end, stat.size - 1);
  res.status(206);
  res.setHeader('Content-Range', `bytes ${start}-${end}/${stat.size}`);
  res.setHeader('Content-Length', end - start + 1);
  createReadStream(filePath, { start, end }).pipe(res);
}

module.exports = router;
