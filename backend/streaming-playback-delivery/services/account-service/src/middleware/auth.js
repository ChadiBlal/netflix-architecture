const jwt = require('jsonwebtoken');
const config = require('../config');
const cache = require('../redis');
const { HttpError, asyncHandler } = require('../utils/errors');

// Requires "Authorization: Bearer <accessToken>". Sets req.user = { id, role, jti, sid, exp }.
const requireAuth = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new HttpError(401, 'Missing access token', 'unauthorized');

  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });
  } catch {
    throw new HttpError(401, 'Invalid or expired access token', 'unauthorized');
  }
  // Logged-out access tokens are denylisted in Redis until they expire.
  const [deniedToken, deniedSession] = await Promise.all([cache.get(`deny:${payload.jti}`), cache.get(`deny:sid:${payload.sid}`)]);
  if (deniedToken || deniedSession) throw new HttpError(401, 'Token revoked', 'unauthorized');

  req.user = { id: payload.sub, role: payload.role, jti: payload.jti, sid: payload.sid, exp: payload.exp };
  next();
});

const requireAdmin = (req, res, next) =>
  req.user?.role === 'admin' ? next() : next(new HttpError(403, 'Admin only', 'forbidden'));

module.exports = { requireAuth, requireAdmin };
