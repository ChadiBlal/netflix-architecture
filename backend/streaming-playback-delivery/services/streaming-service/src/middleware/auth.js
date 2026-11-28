const jwt = require('jsonwebtoken');
const config = require('../config');
const { redis } = require('../redis');

async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: { code: 'unauthorized', message: 'Missing access token' } });
    let payload;
    try {
      payload = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });
    } catch {
      return res.status(401).json({ error: { code: 'unauthorized', message: 'Invalid or expired access token' } });
    }
    const [deniedToken, deniedSession] = await Promise.all([
      redis.get(`deny:${payload.jti}`),
      redis.get(`deny:sid:${payload.sid}`)
    ]);
    if (deniedToken || deniedSession) {
      return res.status(401).json({ error: { code: 'unauthorized', message: 'Token revoked' } });
    }
    req.user = { id: payload.sub, role: payload.role, jti: payload.jti, sid: payload.sid, exp: payload.exp };
    next();
  } catch (err) {
    next(err);
  }
}
module.exports = { requireAuth };
