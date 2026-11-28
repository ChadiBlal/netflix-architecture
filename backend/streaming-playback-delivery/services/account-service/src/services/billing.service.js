const config = require('../config');
const { tx } = require('../db');
const { HttpError } = require('../utils/errors');
const { addMonth, addDays } = require('../utils/dates');
const users = require('../repositories/users.repo');
const repo = require('../repositories/billing.repo');
const gateway = require('./gateway');
const entitlement = require('./entitlement.service');

const MAX_METHODS = 5;
const RETRY_AFTER_MS = 24 * 3600 * 1000;

// ---------------------------------------------------------------- helpers
const planView = (p) => p && ({
  code: p.code, name: p.name, priceCents: p.priceCents, currency: p.currency,
  maxStreams: p.maxStreams, maxResolution: p.maxResolution,
});

function subscriptionView(s) {
  if (!s) return { status: 'none' };
  const renews = s.status !== 'expired' && !s.cancelAtPeriodEnd;
  return {
    id: s.id,
    status: s.status,
    plan: { code: s.planCode, name: s.planName, priceCents: s.priceCents, currency: s.currency,
            maxStreams: s.maxStreams, maxResolution: s.maxResolution },
    pendingPlan: s.pendingPlanCode ? { code: s.pendingPlanCode, name: s.pendingPlanName } : null,
    cancelAtPeriodEnd: s.cancelAtPeriodEnd,
    currentPeriodStart: s.currentPeriodStart,
    currentPeriodEnd: s.currentPeriodEnd,
    nextBillingDate: renews ? s.currentPeriodEnd : null,
    canceledAt: s.canceledAt,
  };
}

const paymentView = (i) => ({
  id: i.id, number: i.number, description: i.description, amountCents: i.amountCents, currency: i.currency,
  status: i.status, failureReason: i.failureReason, paymentMethodId: i.paymentMethodId,
  periodStart: i.periodStart, periodEnd: i.periodEnd, issuedAt: i.issuedAt,
});

// Charges the gateway and ALWAYS records an payment (paid or failed).
async function chargeAndRecord({ userId, method, amountCents, currency, description, subscriptionId, periodStart, periodEnd }, c) {
  const res = await gateway.charge({ method, amountCents });
  const payment = await repo.insertPayment({
    userId, subscriptionId, paymentMethodId: method?.id, description, amountCents, currency,
    status: res.ok ? 'paid' : 'failed', gatewayReference: res.reference, failureReason: res.reason,
    periodStart, periodEnd,
  }, c);
  return { ok: res.ok, reason: res.reason, payment };
}

const paymentFailed = (charge) =>
  new HttpError(402, `Payment failed: ${charge.reason}`, 'payment_failed', { paymentId: charge.payment.id, reason: charge.reason });

// ---------------------------------------------------------------- plans & subscription
const listPlans = async () => (await repo.listPlans()).map(planView);

async function getSubscription(userId) {
  return subscriptionView((await repo.liveSubscription(userId)) || (await repo.latestSubscription(userId)));
}

async function subscribe(userId, { planCode, paymentMethodId }) {
  const out = await tx(async (c) => {
    await users.lockById(userId, c);
    if (await repo.liveSubscription(userId, {}, c)) {
      throw new HttpError(409, 'You already have a subscription. Use PATCH to change plan.', 'already_subscribed');
    }
    const plan = await repo.planByCode(planCode, c);
    if (!plan) throw new HttpError(404, 'Plan not found', 'plan_not_found');
    const method = paymentMethodId ? await repo.methodById(userId, paymentMethodId, c) : await repo.defaultMethod(userId, c);
    if (paymentMethodId && !method) throw new HttpError(404, 'Payment method not found', 'payment_method_not_found');
    if (!method) throw new HttpError(400, 'Add a payment method first', 'no_payment_method');

    const start = new Date();
    const end = addMonth(start);
    const charge = await chargeAndRecord({
      userId, method, amountCents: plan.priceCents, currency: plan.currency,
      description: `${plan.name} plan - first month`, periodStart: start, periodEnd: end,
    }, c);
    if (!charge.ok) return { failed: charge }; // commit the failed payment, then report
    const sub = await repo.insertSubscription(userId, plan.id, start, end, c);
    await repo.attachPaymentToSubscription(charge.payment.id, sub.id, c);
    return { payment: charge.payment };
  });
  if (out.failed) throw paymentFailed(out.failed);
  await entitlement.invalidate(userId);
  return { subscription: await getSubscription(userId), payment: paymentView(out.payment) };
}

async function changePlan(userId, planCode) {
  const out = await tx(async (c) => {
    await users.lockById(userId, c);
    const sub = await repo.liveSubscription(userId, { lock: true }, c);
    if (!sub) throw new HttpError(404, 'No active subscription', 'no_subscription');
    if (sub.status === 'past_due') throw new HttpError(409, 'Resolve the failed payment before changing plan', 'past_due');
    const plan = await repo.planByCode(planCode, c);
    if (!plan) throw new HttpError(404, 'Plan not found', 'plan_not_found');

    if (plan.id === sub.planId) {
      if (!sub.pendingPlanId) throw new HttpError(409, 'You are already on this plan', 'same_plan');
      await repo.updateSubscription(sub.id, { pendingPlanId: null }, c); // cancels the scheduled downgrade
      return { mode: 'cleared' };
    }

    if (plan.priceCents > sub.priceCents) {
      // Upgrade: effective now, charge the prorated difference for the rest of the period.
      const now = new Date();
      const total = new Date(sub.currentPeriodEnd) - new Date(sub.currentPeriodStart);
      const remaining = Math.max(0, new Date(sub.currentPeriodEnd) - now);
      const amount = Math.round(((plan.priceCents - sub.priceCents) * remaining) / total);
      if (amount > 0) {
        const method = await repo.defaultMethod(userId, c);
        if (!method) throw new HttpError(400, 'Add a payment method first', 'no_payment_method');
        const charge = await chargeAndRecord({
          userId, method, amountCents: amount, currency: plan.currency, subscriptionId: sub.id,
          description: `Upgrade ${sub.planName} -> ${plan.name} (prorated)`,
          periodStart: now, periodEnd: sub.currentPeriodEnd,
        }, c);
        if (!charge.ok) return { failed: charge };
      }
      await repo.updateSubscription(sub.id, { planId: plan.id, pendingPlanId: null }, c);
      return { mode: 'upgraded' };
    }

    // Downgrade (or cheaper/equal plan): applies at the next renewal, no refund.
    await repo.updateSubscription(sub.id, { pendingPlanId: plan.id }, c);
    return { mode: 'scheduled' };
  });
  if (out.failed) throw paymentFailed(out.failed);
  await entitlement.invalidate(userId);
  return { change: out.mode, subscription: await getSubscription(userId) };
}

async function cancel(userId) {
  await tx(async (c) => {
    await users.lockById(userId, c);
    const sub = await repo.liveSubscription(userId, { lock: true }, c);
    if (!sub) throw new HttpError(404, 'No active subscription', 'no_subscription');
    if (!sub.cancelAtPeriodEnd) {
      await repo.updateSubscription(sub.id, { cancelAtPeriodEnd: true, canceledAt: new Date() }, c);
    }
  });
  await entitlement.invalidate(userId);
  return getSubscription(userId);
}

async function resume(userId) {
  await tx(async (c) => {
    await users.lockById(userId, c);
    const sub = await repo.liveSubscription(userId, { lock: true }, c);
    if (!sub) throw new HttpError(409, 'Subscription already ended. Please subscribe again.', 'subscription_ended');
    if (sub.cancelAtPeriodEnd) await repo.updateSubscription(sub.id, { cancelAtPeriodEnd: false, canceledAt: null }, c);
  });
  await entitlement.invalidate(userId);
  return getSubscription(userId);
}

// ---------------------------------------------------------------- payment methods
const listMethods = (userId) => repo.listMethods(userId);

async function addMethod(userId, { number, expMonth, expYear, holderName, makeDefault }) {
  const method = await tx(async (c) => {
    await users.lockById(userId, c);
    const count = await repo.countMethods(userId, c);
    if (count >= MAX_METHODS) throw new HttpError(409, `A maximum of ${MAX_METHODS} cards is allowed`, 'method_limit');
    const isDefault = count === 0 || !!makeDefault;
    if (isDefault) await repo.clearDefault(userId, c);
    return repo.insertMethod(userId, {
      brand: gateway.brandOf(number), last4: number.slice(-4), expMonth, expYear, holderName,
      token: gateway.tokenize(), isDefault,
    }, c);
  });
  return method; // the card number and CVC are discarded; only brand/last4/expiry are kept
}

async function setDefaultMethod(userId, id) {
  await tx(async (c) => {
    await users.lockById(userId, c);
    if (!(await repo.methodById(userId, id, c))) throw new HttpError(404, 'Payment method not found', 'not_found');
    await repo.clearDefault(userId, c);
    await repo.setDefault(userId, id, c);
  });
}

async function removeMethod(userId, id) {
  await tx(async (c) => {
    await users.lockById(userId, c);
    const m = await repo.methodById(userId, id, c);
    if (!m) throw new HttpError(404, 'Payment method not found', 'not_found');
    const count = await repo.countMethods(userId, c);
    const sub = await repo.liveSubscription(userId, {}, c);
    if (sub && !sub.cancelAtPeriodEnd && count === 1) {
      throw new HttpError(409, 'Cancel your subscription or add another card before removing your only card', 'only_method');
    }
    await repo.softDeleteMethod(userId, id, c);
    if (m.isDefault) { // promote the newest remaining card
      const rest = (await repo.listMethods(userId, c)).filter((x) => x.id !== id);
      if (rest.length) await repo.setDefault(userId, rest[rest.length - 1].id, c);
    }
  });
}

// ---------------------------------------------------------------- payments
async function listPayments(userId, limit, offset) {
  return (await repo.listPayments(userId, limit, offset)).map(paymentView);
}
async function getPayment(userId, id) {
  const i = await repo.paymentById(userId, id);
  if (!i) throw new HttpError(404, 'Payment not found', 'not_found');
  return paymentView(i);
}

// ---------------------------------------------------------------- renewals (background worker)
async function renewOne(sub, now, c) {
  if (sub.cancelAtPeriodEnd) {
    await repo.updateSubscription(sub.id, { status: 'expired' }, c);
    return;
  }
  const periodEnd = new Date(sub.currentPeriodEnd);
  if (sub.status === 'past_due') {
    if (now >= addDays(periodEnd, config.graceDays)) { // grace period over
      await repo.updateSubscription(sub.id, { status: 'expired' }, c);
      return;
    }
    const last = await repo.lastPaymentAt(sub.id, c);
    if (last && now - new Date(last) < RETRY_AFTER_MS) return; // retry at most once a day
  }

  const plan = await repo.planByCode(sub.pendingPlanCode || sub.planCode, c);
  const method = await repo.defaultMethod(sub.userId, c);
  const onTime = sub.status === 'active' && now - periodEnd < RETRY_AFTER_MS;
  const start = onTime ? periodEnd : now;
  const end = addMonth(start);

  const charge = await chargeAndRecord({
    userId: sub.userId, method, amountCents: plan.priceCents, currency: plan.currency, subscriptionId: sub.id,
    description: `${plan.name} plan - monthly renewal`, periodStart: start, periodEnd: end,
  }, c);

  if (charge.ok) {
    await repo.updateSubscription(sub.id, {
      planId: plan.id, pendingPlanId: null, status: 'active', periodStart: start, periodEnd: end,
    }, c);
  } else if (sub.status === 'active') {
    await repo.updateSubscription(sub.id, { status: 'past_due' }, c);
  }
}

// Processes every subscription whose period has ended. Safe to run from several processes at once.
async function processRenewals(now = new Date(), batch = 200) {
  const touched = await tx(async (c) => {
    const due = await repo.dueSubscriptions(now, batch, c);
    for (const sub of due) await renewOne(sub, now, c);
    return due.map((s) => s.userId);
  });
  await Promise.all(touched.map((id) => entitlement.invalidate(id)));
  return touched.length;
}

module.exports = {
  listPlans, getSubscription, subscribe, changePlan, cancel, resume,
  listMethods, addMethod, setDefaultMethod, removeMethod,
  listPayments, getPayment, processRenewals,
};
