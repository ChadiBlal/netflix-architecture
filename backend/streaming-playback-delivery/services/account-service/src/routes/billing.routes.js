// Billing routes. Also mounted at /api/users so they are reachable through the Zuul route.
const router = require('express').Router();
const { asyncHandler } = require('../utils/errors');
const { requireAuth } = require('../middleware/auth');
const s = require('./schemas');
const billing = require('../services/billing.service');
const entitlement = require('../services/entitlement.service');

// ---- public: plan catalogue
router.get('/plans', asyncHandler(async (req, res) => {
  res.json({ plans: await billing.listPlans() });
}));

// ---- subscription
router.get('/me/subscription', requireAuth, asyncHandler(async (req, res) => {
  res.json({ subscription: await billing.getSubscription(req.user.id) });
}));
router.post('/me/subscription', requireAuth, asyncHandler(async (req, res) => {
  res.status(201).json(await billing.subscribe(req.user.id, s.subscribe.parse(req.body)));
}));
router.patch('/me/subscription', requireAuth, asyncHandler(async (req, res) => {
  res.json(await billing.changePlan(req.user.id, s.changePlan.parse(req.body).planCode));
}));
router.delete('/me/subscription', requireAuth, asyncHandler(async (req, res) => {
  res.json({ subscription: await billing.cancel(req.user.id) });
}));
router.post('/me/subscription/resume', requireAuth, asyncHandler(async (req, res) => {
  res.json({ subscription: await billing.resume(req.user.id) });
}));

// Can this user stream, and at what quality? (cached in Redis)
router.get('/me/entitlement', requireAuth, asyncHandler(async (req, res) => {
  res.json({ entitlement: await entitlement.get(req.user.id) });
}));

// ---- payment methods
router.get('/me/payment-methods', requireAuth, asyncHandler(async (req, res) => {
  res.json({ paymentMethods: await billing.listMethods(req.user.id) });
}));
router.post('/me/payment-methods', requireAuth, asyncHandler(async (req, res) => {
  res.status(201).json({ paymentMethod: await billing.addMethod(req.user.id, s.addMethod.parse(req.body)) });
}));
router.put('/me/payment-methods/:id/default', requireAuth, asyncHandler(async (req, res) => {
  await billing.setDefaultMethod(req.user.id, s.idParam.parse(req.params).id);
  res.json({ paymentMethods: await billing.listMethods(req.user.id) });
}));
router.delete('/me/payment-methods/:id', requireAuth, asyncHandler(async (req, res) => {
  await billing.removeMethod(req.user.id, s.idParam.parse(req.params).id);
  res.status(204).end();
}));

// ---- payment history (processing log). /me/invoices is kept as an alias.
router.get(['/me/payments', '/me/invoices'], requireAuth, asyncHandler(async (req, res) => {
  const { limit, offset } = s.pagination.parse(req.query);
  res.json({ payments: await billing.listPayments(req.user.id, limit, offset), limit, offset });
}));
router.get(['/me/payments/:id', '/me/invoices/:id'], requireAuth, asyncHandler(async (req, res) => {
  res.json({ payment: await billing.getPayment(req.user.id, s.idParam.parse(req.params).id) });
}));

module.exports = router;
