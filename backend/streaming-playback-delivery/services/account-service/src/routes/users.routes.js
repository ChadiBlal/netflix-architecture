// Account routes. Mounted at /api/users (Zuul forwards the path unchanged).
const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const config = require('../config');
const { asyncHandler, HttpError } = require('../utils/errors');
const { requireAuth } = require('../middleware/auth');
const s = require('./schemas');
const auth = require('../services/auth.service');
const profiles = require('../services/profile.service');
const users = require('../repositories/users.repo');
const sessions = require('../services/session.service');

const meta = (req) => ({ device: (req.headers['user-agent'] || 'unknown').slice(0, 200), ip: req.ip });

const authLimiter = rateLimit({
  windowMs: 60_000,
  limit: config.isProd ? 10 : 200,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: { code: 'rate_limited', message: 'Too many attempts, try again in a minute' } },
});

// ---- public
router.post('/register', authLimiter, asyncHandler(async (req, res) => {
  res.status(201).json(await auth.register(s.register.parse(req.body), meta(req)));
}));
router.post('/login', authLimiter, asyncHandler(async (req, res) => {
  res.json(await auth.login(s.login.parse(req.body), meta(req)));
}));
router.post('/refresh', authLimiter, asyncHandler(async (req, res) => {
  res.json(await auth.refresh(s.refresh.parse(req.body).refreshToken, meta(req)));
}));

// ---- authenticated
router.post('/logout', requireAuth, asyncHandler(async (req, res) => {
  await auth.logout(req.user);
  res.status(204).end();
}));

router.get('/me', requireAuth, asyncHandler(async (req, res) => {
  const user = await users.findById(req.user.id);
  if (!user) throw new HttpError(404, 'User not found', 'not_found');
  res.json({ user });
}));
router.patch('/me', requireAuth, asyncHandler(async (req, res) => {
  const user = await users.update(req.user.id, s.updateMe.parse(req.body));
  if (!user) throw new HttpError(404, 'User not found', 'not_found');
  res.json({ user });
}));
router.post('/me/password', requireAuth, asyncHandler(async (req, res) => {
  await auth.changePassword(req.user, s.changePassword.parse(req.body));
  res.status(204).end();
}));
router.delete('/me', requireAuth, asyncHandler(async (req, res) => {
  await auth.deleteAccount(req.user, s.deleteAccount.parse(req.body).password);
  res.status(204).end();
}));

// ---- active sessions (stored in Redis)
router.get('/me/sessions', requireAuth, asyncHandler(async (req, res) => {
  res.json({ sessions: await sessions.list(req.user.id, req.user.sid) });
}));
router.delete('/me/sessions', requireAuth, asyncHandler(async (req, res) => { // sign out all OTHER devices
  await sessions.revokeAll(req.user.id, req.user.sid);
  res.status(204).end();
}));
router.delete('/me/sessions/:sid', requireAuth, asyncHandler(async (req, res) => {
  await sessions.revokeOne(req.user.id, s.sidParam.parse(req.params).sid);
  res.status(204).end();
}));

// ---- profiles
router.get('/me/profiles', requireAuth, asyncHandler(async (req, res) => {
  res.json({ profiles: await profiles.list(req.user.id) });
}));
router.post('/me/profiles', requireAuth, asyncHandler(async (req, res) => {
  res.status(201).json({ profile: await profiles.create(req.user.id, s.profileCreate.parse(req.body)) });
}));
router.patch('/me/profiles/:id', requireAuth, asyncHandler(async (req, res) => {
  const { id } = s.idParam.parse(req.params);
  res.json({ profile: await profiles.update(req.user.id, id, s.profileUpdate.parse(req.body)) });
}));
router.delete('/me/profiles/:id', requireAuth, asyncHandler(async (req, res) => {
  const { id } = s.idParam.parse(req.params);
  await profiles.remove(req.user.id, id);
  res.status(204).end();
}));

module.exports = router;
