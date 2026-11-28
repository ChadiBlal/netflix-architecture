const { query } = require('../db');

const insert = (userId, sessionId, tokenHash, expiresAt, c) =>
  query('INSERT INTO refresh_tokens (user_id, session_id, token_hash, expires_at) VALUES ($1, $2, $3, $4)',
    [userId, sessionId, tokenHash, expiresAt], c);

const findByHash = async (hash, c) =>
  (await query('SELECT * FROM refresh_tokens WHERE token_hash = $1 FOR UPDATE', [hash], c))[0];

const revoke = (id, c) => query('UPDATE refresh_tokens SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL', [id], c);

const revokeAllForUser = (userId, c) =>
  query('UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL', [userId], c);

const revokeSession = (userId, sessionId, c) =>
  query('UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND session_id = $2 AND revoked_at IS NULL', [userId, sessionId], c);

// Fallback for listing sessions when Redis is unavailable.
const activeSessions = (userId, c) =>
  query(`SELECT session_id, min(created_at) AS created_at FROM refresh_tokens
         WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > now()
         GROUP BY session_id ORDER BY min(created_at)`, [userId], c);

const purgeExpired = () => query("DELETE FROM refresh_tokens WHERE expires_at < now() - interval '7 days'");

module.exports = { insert, findByHash, revoke, revokeAllForUser, revokeSession, activeSessions, purgeExpired };
