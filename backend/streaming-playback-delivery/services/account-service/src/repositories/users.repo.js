const { query } = require('../db');

const PUBLIC = 'id, email, full_name, country, role, created_at';

const findByEmail = async (email, c) =>
  (await query('SELECT * FROM users WHERE lower(email) = lower($1) AND deleted_at IS NULL', [email], c))[0];

const findById = async (id, c) =>
  (await query(`SELECT ${PUBLIC} FROM users WHERE id = $1 AND deleted_at IS NULL`, [id], c))[0];

const findAuthById = async (id, c) =>
  (await query('SELECT * FROM users WHERE id = $1 AND deleted_at IS NULL', [id], c))[0];

// Row lock: serialises concurrent billing / profile operations for one user.
const lockById = async (id, c) =>
  (await query('SELECT id FROM users WHERE id = $1 AND deleted_at IS NULL FOR UPDATE', [id], c))[0];

const insert = async ({ email, passwordHash, fullName, country }, c) =>
  (await query(
    `INSERT INTO users (email, password_hash, full_name, country)
     VALUES ($1, $2, $3, $4) RETURNING ${PUBLIC}`,
    [email, passwordHash, fullName, country || null], c))[0];

const update = async (id, { fullName, country }, c) =>
  (await query(
    `UPDATE users SET full_name = COALESCE($2, full_name), country = COALESCE($3, country), updated_at = now()
     WHERE id = $1 AND deleted_at IS NULL RETURNING ${PUBLIC}`,
    [id, fullName ?? null, country ?? null], c))[0];

const setPassword = (id, hash, c) =>
  query('UPDATE users SET password_hash = $2, updated_at = now() WHERE id = $1', [id, hash], c);

// Soft delete + anonymise (invoices are kept for accounting).
const softDelete = (id, c) =>
  query(
    `UPDATE users SET deleted_at = now(), full_name = 'Deleted user',
       email = 'deleted+' || id || '@deleted.invalid', updated_at = now()
     WHERE id = $1`, [id], c);

module.exports = { findByEmail, findById, findAuthById, lockById, insert, update, setPassword, softDelete };
