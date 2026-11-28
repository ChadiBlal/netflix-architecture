const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const config = require('../config');
const cache = require('../redis');
const { tx } = require('../db');
const { HttpError } = require('../utils/errors');
const { addDays } = require('../utils/dates');
const users = require('../repositories/users.repo');
const tokens = require('../repositories/tokens.repo');
const profiles = require('../repositories/profiles.repo');
const billing = require('../repositories/billing.repo');
const entitlement = require('./entitlement.service');
const sessions = require('./session.service');

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
// Used to keep login timing similar whether or not the email exists.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

// One login = one session (sid). The sid is kept across refresh-token rotation.
async function issueTokens(user, sid, c) {
  const jti = crypto.randomUUID();
  const accessToken = jwt.sign({ role: user.role, jti, sid }, config.jwtSecret, {
    subject: user.id, expiresIn: config.accessTtlSeconds, algorithm: 'HS256',
  });
  const refreshToken = crypto.randomBytes(48).toString('base64url');
  await tokens.insert(user.id, sid, sha256(refreshToken), addDays(new Date(), config.refreshTtlDays), c);
  return { accessToken, refreshToken, tokenType: 'Bearer', expiresIn: config.accessTtlSeconds, sessionId: sid };
}

async function register({ email, password, fullName, country }, meta) {
  const passwordHash = await bcrypt.hash(password, 10);
  let out;
  try {
    out = await tx(async (c) => {
      const user = await users.insert({ email, passwordHash, fullName, country }, c);
      await profiles.insert(user.id, { name: fullName.split(' ')[0] }, c); // default profile
      return { user, ...(await issueTokens(user, crypto.randomUUID(), c)) };
    });
  } catch (err) {
    if (err.code === '23505') throw new HttpError(409, 'An account with this email already exists', 'email_taken');
    throw err;
  }
  await sessions.create(out.user.id, out.sessionId, meta);
  return out;
}

async function login({ email, password }, meta) {
  const row = await users.findByEmail(email);
  const ok = await bcrypt.compare(password, row ? row.passwordHash : DUMMY_HASH);
  if (!row || !ok) throw new HttpError(401, 'Invalid email or password', 'invalid_credentials');
  const { passwordHash, deletedAt, ...user } = row; // eslint-disable-line no-unused-vars
  const out = { user, ...(await issueTokens(user, crypto.randomUUID())) };
  await sessions.create(user.id, out.sessionId, meta);
  return out;
}

async function refresh(refreshToken, meta) {
  const out = await tx(async (c) => {
    const row = await tokens.findByHash(sha256(refreshToken), c);
    if (!row) return { error: 'invalid' };
    if (row.revokedAt) {
      // A revoked token was replayed: assume theft and kill every session.
      await tokens.revokeAllForUser(row.userId, c);
      return { error: 'reuse', userId: row.userId };
    }
    if (new Date(row.expiresAt) < new Date()) return { error: 'invalid' };
    const user = await users.findById(row.userId, c);
    if (!user) return { error: 'invalid' };
    await tokens.revoke(row.id, c); // rotation: each refresh token is single-use
    return { user, ...(await issueTokens(user, row.sessionId, c)) };
  });
  if (out.error === 'reuse') await sessions.revokeAll(out.userId);
  if (out.error) throw new HttpError(401, 'Invalid refresh token', 'invalid_refresh_token');
  await sessions.touch(out.user.id, out.sessionId, meta);
  return out;
}

// Ends the CURRENT session only (this device).
async function logout(authUser) {
  await sessions.revoke(authUser.id, authUser.sid);
  const ttl = authUser.exp - Math.floor(Date.now() / 1000);
  if (ttl > 0) await cache.set(`deny:${authUser.jti}`, '1', ttl);
}

async function changePassword(authUser, { currentPassword, newPassword }) {
  const row = await users.findAuthById(authUser.id);
  if (!row || !(await bcrypt.compare(currentPassword, row.passwordHash))) {
    throw new HttpError(403, 'Current password is incorrect', 'wrong_password');
  }
  const hash = await bcrypt.hash(newPassword, 10);
  await tx((c) => users.setPassword(authUser.id, hash, c));
  await sessions.revokeAll(authUser.id); // sign out everywhere, including this device
}

async function deleteAccount(authUser, password) {
  const row = await users.findAuthById(authUser.id);
  if (!row || !(await bcrypt.compare(password, row.passwordHash))) {
    throw new HttpError(403, 'Password is incorrect', 'wrong_password');
  }
  await tx(async (c) => {
    await users.lockById(authUser.id, c);
    const sub = await billing.liveSubscription(authUser.id, { lock: true }, c);
    if (sub) await billing.updateSubscription(sub.id, { status: 'expired', cancelAtPeriodEnd: true, canceledAt: new Date() }, c);
    await users.softDelete(authUser.id, c);
  });
  await sessions.revokeAll(authUser.id);
  await entitlement.invalidate(authUser.id);
}

module.exports = { register, login, refresh, logout, changePassword, deleteAccount };
