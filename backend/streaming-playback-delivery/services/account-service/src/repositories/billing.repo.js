const { query } = require('../db');

// ---------- plans ----------
const listPlans = (c) =>
  query('SELECT id, code, name, price_cents, currency, max_streams, max_resolution FROM plans WHERE active ORDER BY price_cents', [], c);
const planByCode = async (code, c) =>
  (await query('SELECT * FROM plans WHERE code = $1 AND active', [code], c))[0];

// ---------- payment methods ----------
const PM = 'id, brand, last4, exp_month, exp_year, holder_name, is_default, created_at';
const listMethods = (userId, c) =>
  query(`SELECT ${PM} FROM payment_methods WHERE user_id = $1 AND deleted_at IS NULL ORDER BY is_default DESC, created_at`, [userId], c);
const methodById = async (userId, id, c) =>
  (await query('SELECT * FROM payment_methods WHERE id = $2 AND user_id = $1 AND deleted_at IS NULL', [userId, id], c))[0];
const defaultMethod = async (userId, c) =>
  (await query('SELECT * FROM payment_methods WHERE user_id = $1 AND is_default AND deleted_at IS NULL', [userId], c))[0];
const countMethods = async (userId, c) =>
  Number((await query('SELECT count(*)::int AS n FROM payment_methods WHERE user_id = $1 AND deleted_at IS NULL', [userId], c))[0].n);
const clearDefault = (userId, c) =>
  query('UPDATE payment_methods SET is_default = FALSE WHERE user_id = $1 AND is_default', [userId], c);
const insertMethod = async (userId, m, c) =>
  (await query(
    `INSERT INTO payment_methods (user_id, brand, last4, exp_month, exp_year, holder_name, token, is_default)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING ${PM}`,
    [userId, m.brand, m.last4, m.expMonth, m.expYear, m.holderName, m.token, m.isDefault], c))[0];
const setDefault = (userId, id, c) =>
  query('UPDATE payment_methods SET is_default = TRUE WHERE id = $2 AND user_id = $1', [userId, id], c);
const softDeleteMethod = (userId, id, c) =>
  query('UPDATE payment_methods SET deleted_at = now(), is_default = FALSE WHERE id = $2 AND user_id = $1', [userId, id], c);

// ---------- subscriptions ----------
const SUB_SELECT = `
  SELECT s.*, p.code AS plan_code, p.name AS plan_name, p.price_cents, p.currency,
         p.max_streams, p.max_resolution, pp.code AS pending_plan_code, pp.name AS pending_plan_name
  FROM subscriptions s
  JOIN plans p ON p.id = s.plan_id
  LEFT JOIN plans pp ON pp.id = s.pending_plan_id`;

const liveSubscription = async (userId, { lock = false } = {}, c) =>
  (await query(
    `${SUB_SELECT} WHERE s.user_id = $1 AND s.status IN ('active','past_due') ${lock ? 'FOR UPDATE OF s' : ''}`,
    [userId], c))[0];

const latestSubscription = async (userId, c) =>
  (await query(`${SUB_SELECT} WHERE s.user_id = $1 ORDER BY s.created_at DESC LIMIT 1`, [userId], c))[0];

const insertSubscription = async (userId, planId, start, end, c) =>
  (await query(
    `INSERT INTO subscriptions (user_id, plan_id, current_period_start, current_period_end)
     VALUES ($1,$2,$3,$4) RETURNING id`, [userId, planId, start, end], c))[0];

const updateSubscription = (id, f, c) =>
  query(
    `UPDATE subscriptions SET
       plan_id = COALESCE($2, plan_id),
       pending_plan_id = CASE WHEN $3::boolean THEN $4 ELSE pending_plan_id END,
       status = COALESCE($5, status),
       cancel_at_period_end = COALESCE($6, cancel_at_period_end),
       canceled_at = CASE WHEN $7::boolean THEN $8 ELSE canceled_at END,
       current_period_start = COALESCE($9, current_period_start),
       current_period_end = COALESCE($10, current_period_end)
     WHERE id = $1`,
    [id, f.planId ?? null, 'pendingPlanId' in f, f.pendingPlanId ?? null, f.status ?? null,
     f.cancelAtPeriodEnd ?? null, 'canceledAt' in f, f.canceledAt ?? null,
     f.periodStart ?? null, f.periodEnd ?? null], c);

// Subscriptions whose period ended. SKIP LOCKED makes multiple workers safe.
const dueSubscriptions = (now, limit, c) =>
  query(
    `${SUB_SELECT} WHERE s.status IN ('active','past_due') AND s.current_period_end <= $1
     ORDER BY s.current_period_end LIMIT $2 FOR UPDATE OF s SKIP LOCKED`, [now, limit], c);

// ---------- payments ----------
const insertPayment = async (i, c) =>
  (await query(
    `INSERT INTO payments (user_id, subscription_id, payment_method_id, description, amount_cents, currency,
                           status, gateway_reference, failure_reason, period_start, period_end)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
    [i.userId, i.subscriptionId || null, i.paymentMethodId || null, i.description, i.amountCents, i.currency,
     i.status, i.gatewayReference || null, i.failureReason || null, i.periodStart || null, i.periodEnd || null], c))[0];
const attachPaymentToSubscription = (paymentId, subId, c) =>
  query('UPDATE payments SET subscription_id = $2 WHERE id = $1', [paymentId, subId], c);
const listPayments = (userId, limit, offset, c) =>
  query('SELECT * FROM payments WHERE user_id = $1 ORDER BY issued_at DESC, number DESC LIMIT $2 OFFSET $3', [userId, limit, offset], c);
const lastPaymentAt = async (subscriptionId, c) =>
  (await query('SELECT max(issued_at) AS at FROM payments WHERE subscription_id = $1', [subscriptionId], c))[0].at;
const paymentById = async (userId, id, c) =>
  (await query('SELECT * FROM payments WHERE id = $2 AND user_id = $1', [userId, id], c))[0];

module.exports = {
  listPlans, planByCode,
  listMethods, methodById, defaultMethod, countMethods, clearDefault, insertMethod, setDefault, softDeleteMethod,
  liveSubscription, latestSubscription, insertSubscription, updateSubscription, dueSubscriptions,
  insertPayment, attachPaymentToSubscription, listPayments, lastPaymentAt, paymentById,
};
