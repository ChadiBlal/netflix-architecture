const { query } = require('../db');

const listByUser = (userId, c) =>
  query('SELECT id, name, avatar, is_kids, created_at FROM profiles WHERE user_id = $1 ORDER BY created_at', [userId], c);

const countByUser = async (userId, c) =>
  Number((await query('SELECT count(*)::int AS n FROM profiles WHERE user_id = $1', [userId], c))[0].n);

const insert = async (userId, { name, avatar, isKids }, c) =>
  (await query(
    `INSERT INTO profiles (user_id, name, avatar, is_kids) VALUES ($1, $2, $3, $4)
     RETURNING id, name, avatar, is_kids, created_at`,
    [userId, name, avatar || null, !!isKids], c))[0];

const update = async (userId, id, { name, avatar, isKids }, c) =>
  (await query(
    `UPDATE profiles SET name = COALESCE($3, name), avatar = COALESCE($4, avatar), is_kids = COALESCE($5, is_kids)
     WHERE id = $2 AND user_id = $1 RETURNING id, name, avatar, is_kids, created_at`,
    [userId, id, name ?? null, avatar ?? null, isKids ?? null], c))[0];

const remove = async (userId, id, c) =>
  (await query('DELETE FROM profiles WHERE id = $2 AND user_id = $1 RETURNING id', [userId, id], c))[0];

module.exports = { listByUser, countByUser, insert, update, remove };
