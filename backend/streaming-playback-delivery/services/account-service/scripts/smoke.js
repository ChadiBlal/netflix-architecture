// End-to-end smoke test. Start the service first, then:  npm run smoke
// BASE_URL defaults to the service itself; use http://localhost:8080 to test through Zuul.
const BASE = process.env.BASE_URL || 'http://localhost:5001';
let passed = 0, failed = 0;

async function call(method, path, { body, token } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}
function check(name, cond, extra) {
  if (cond) { passed++; console.log(`  ok   ${name}`); }
  else { failed++; console.log(`  FAIL ${name}`, extra !== undefined ? JSON.stringify(extra) : ''); }
}

(async () => {
  const email = `smoke+${Date.now()}@example.com`;
  const pw = 'correct-horse-9';
  const card = { cvc: '123', expMonth: 12, expYear: new Date().getUTCFullYear() + 2, holderName: 'Smoke Test' };
  let r;

  console.log('health / plans');
  r = await call('GET', '/api/users/health'); check('health 200', r.status === 200 && r.body.postgres === 'up', r.body);
  r = await call('GET', '/api/users/plans'); check('3 plans', r.body.plans?.length === 3, r.body);

  console.log('accounts');
  r = await call('POST', '/api/users/register', { body: { email, password: pw, fullName: 'Smoke Tester', country: 'ma' } });
  check('register 201', r.status === 201 && r.body.accessToken, r.body);
  let { accessToken: at, refreshToken: rt } = r.body;
  r = await call('POST', '/api/users/register', { body: { email, password: pw, fullName: 'Dup' } });
  check('duplicate email 409', r.status === 409, r.body);
  r = await call('POST', '/api/users/register', { body: { email: 'bad', password: '1' , fullName: ''} });
  check('validation 400', r.status === 400 && r.body.error.details.length >= 2, r.body);
  r = await call('POST', '/api/users/login', { body: { email, password: 'wrong-password' } });
  check('bad password 401', r.status === 401, r.body);
  r = await call('GET', '/api/users/me'); check('no token 401', r.status === 401);
  r = await call('GET', '/api/users/me', { token: at });
  check('me ok', r.status === 200 && r.body.user.email === email && r.body.user.country === 'MA' && !r.body.user.passwordHash, r.body);

  console.log('profiles');
  r = await call('GET', '/api/users/me/profiles', { token: at });
  check('default profile exists', r.body.profiles?.length === 1, r.body);
  const firstProfile = r.body.profiles[0].id;
  for (let i = 0; i < 4; i++) await call('POST', '/api/users/me/profiles', { token: at, body: { name: `P${i}`, isKids: i === 0 } });
  r = await call('POST', '/api/users/me/profiles', { token: at, body: { name: 'Sixth' } });
  check('6th profile 409', r.status === 409 && r.body.error.code === 'profile_limit', r.body);
  r = await call('DELETE', `/api/users/me/profiles/${firstProfile}`, { token: at });
  check('delete profile 204', r.status === 204);

  console.log('billing: no card / bad card / declined card');
  r = await call('GET', '/api/users/me/subscription', { token: at }); check('status none', r.body.subscription.status === 'none', r.body);
  r = await call('GET', '/api/users/me/entitlement', { token: at }); check('not entitled', r.body.entitlement.entitled === false, r.body);
  r = await call('POST', '/api/users/me/subscription', { token: at, body: { planCode: 'basic' } });
  check('subscribe w/o card 400', r.status === 400 && r.body.error.code === 'no_payment_method', r.body);
  r = await call('POST', '/api/users/me/payment-methods', { token: at, body: { ...card, number: '4242424242424241' } });
  check('bad luhn 400', r.status === 400, r.body);
  r = await call('POST', '/api/users/me/payment-methods', { token: at, body: { ...card, number: '4000 0000 0000 0002' } });
  check('add declining card', r.status === 201 && r.body.paymentMethod.last4 === '0002' && r.body.paymentMethod.isDefault && !('token' in r.body.paymentMethod), r.body);
  const badCardId = r.body.paymentMethod.id;
  r = await call('POST', '/api/users/me/subscription', { token: at, body: { planCode: 'basic' } });
  check('declined -> 402', r.status === 402 && r.body.error.code === 'payment_failed', r.body);
  r = await call('GET', '/api/users/me/payments', { token: at });
  check('failed payment logged', r.body.payments.length === 1 && r.body.payments[0].status === 'failed', r.body);

  console.log('billing: subscribe / change / cancel');
  r = await call('POST', '/api/users/me/payment-methods', { token: at, body: { ...card, number: '4242 4242 4242 4242', makeDefault: true } });
  check('add good card as default', r.status === 201 && r.body.paymentMethod.brand === 'visa' && r.body.paymentMethod.isDefault, r.body);
  const goodCardId = r.body.paymentMethod.id;
  r = await call('POST', '/api/users/me/subscription', { token: at, body: { planCode: 'basic' } });
  check('subscribe 201', r.status === 201 && r.body.subscription.status === 'active' && r.body.payment.amountCents === 799, r.body);
  r = await call('POST', '/api/users/me/subscription', { token: at, body: { planCode: 'basic' } });
  check('double subscribe 409', r.status === 409, r.body);
  r = await call('GET', '/api/users/me/entitlement', { token: at });
  check('entitled (basic, 720p)', r.body.entitlement.entitled && r.body.entitlement.maxResolution === '720p', r.body);
  r = await call('GET', '/api/users/me/entitlement', { token: at });
  check('entitlement served from Redis cache', r.body.entitlement.cached === true, r.body);

  r = await call('PATCH', '/api/users/me/subscription', { token: at, body: { planCode: 'premium' } });
  check('upgrade now', r.body.change === 'upgraded' && r.body.subscription.plan.code === 'premium', r.body);
  r = await call('GET', '/api/users/me/entitlement', { token: at });
  check('cache invalidated after upgrade (4K)', r.body.entitlement.maxResolution === '4K', r.body);
  r = await call('GET', '/api/users/me/payments', { token: at });
  const prorated = r.body.payments.find((i) => i.description.includes('prorated'));
  check('prorated payment ~1000c', prorated && prorated.amountCents > 990 && prorated.amountCents <= 1000, prorated);
  r = await call('PATCH', '/api/users/me/subscription', { token: at, body: { planCode: 'standard' } });
  check('downgrade scheduled', r.body.change === 'scheduled' && r.body.subscription.pendingPlan.code === 'standard' && r.body.subscription.plan.code === 'premium', r.body);
  r = await call('DELETE', '/api/users/me/subscription', { token: at });
  check('cancel at period end', r.body.subscription.cancelAtPeriodEnd === true && r.body.subscription.nextBillingDate === null, r.body);
  r = await call('POST', '/api/users/me/subscription/resume', { token: at });
  check('resume', r.body.subscription.cancelAtPeriodEnd === false, r.body);
  r = await call('DELETE', `/api/users/me/payment-methods/${goodCardId}`, { token: at });
  check('cannot remove only-working default w/ active sub? (2 cards -> allowed)', r.status === 204, r.body);
  r = await call('GET', '/api/users/me/payment-methods', { token: at });
  check('declining card promoted to default', r.body.paymentMethods.length === 1 && r.body.paymentMethods[0].id === badCardId && r.body.paymentMethods[0].isDefault, r.body);
  r = await call('DELETE', `/api/users/me/payment-methods/${badCardId}`, { token: at });
  check('remove last card while subscribed 409', r.status === 409, r.body);

  console.log('billing: renewals (direct worker call, simulated dates)');
  const billing = require('../src/services/billing.service');
  const { pool } = require('../src/db');
  const { redis } = require('../src/redis');
  const day = 86400000;
  let n = await billing.processRenewals(new Date());
  r = await call('GET', '/api/users/me/subscription', { token: at });
  check('nothing due now', r.body.subscription.status === 'active' && r.body.subscription.plan.code === 'premium', r.body);
  const end = new Date(r.body.subscription.currentPeriodEnd);
  await billing.processRenewals(new Date(end.getTime() + 1000)); // renews with declining card
  r = await call('GET', '/api/users/me/subscription', { token: at });
  check('renewal with declined card -> past_due', r.body.subscription.status === 'past_due', r.body);
  r = await call('GET', '/api/users/me/entitlement', { token: at });
  check('still entitled during grace', r.body.entitlement.entitled === true, r.body);
  r = await call('PATCH', '/api/users/me/subscription', { token: at, body: { planCode: 'basic' } });
  check('cannot change plan while past_due', r.status === 409, r.body);
  r = await call('POST', '/api/users/me/payment-methods', { token: at, body: { ...card, number: '5555555555554444', makeDefault: true } });
  check('add MasterCard default', r.status === 201 && r.body.paymentMethod.brand === 'mastercard', r.body);
  await billing.processRenewals(new Date(end.getTime() + 2 * day)); // retry with new card
  r = await call('GET', '/api/users/me/subscription', { token: at });
  check('retry succeeds -> active, scheduled downgrade applied', r.body.subscription.status === 'active' && r.body.subscription.plan.code === 'standard' && !r.body.subscription.pendingPlan, r.body);
  await call('DELETE', '/api/users/me/subscription', { token: at });
  const end2 = new Date((await call('GET', '/api/users/me/subscription', { token: at })).body.subscription.currentPeriodEnd);
  await billing.processRenewals(new Date(end2.getTime() + 1000));
  r = await call('GET', '/api/users/me/subscription', { token: at });
  check('canceled sub expires at period end', r.body.subscription.status === 'expired', r.body);
  r = await call('GET', '/api/users/me/entitlement', { token: at });
  check('no longer entitled', r.body.entitlement.entitled === false, r.body);
  r = await call('POST', '/api/users/me/subscription', { token: at, body: { planCode: 'basic' } });
  check('can re-subscribe after expiry', r.status === 201, r.body);

  console.log('payments');
  r = await call('GET', '/api/users/me/payments?limit=2', { token: at });
  check('pagination', r.body.payments.length === 2, r.body);
  r = await call('GET', `/api/users/me/payments/${r.body.payments[0].id}`, { token: at });
  check('payment detail', r.status === 200 && /^PAY-\d{8}$/.test(r.body.payment.number), r.body);

  console.log('tokens / session security');
  r = await call('POST', '/api/users/refresh', { body: { refreshToken: rt } });
  check('refresh rotates', r.status === 200 && r.body.refreshToken !== rt, r.body);
  const rt2 = r.body.refreshToken; const at2 = r.body.accessToken;
  r = await call('POST', '/api/users/refresh', { body: { refreshToken: rt } });
  check('reusing old refresh token 401', r.status === 401);
  r = await call('POST', '/api/users/refresh', { body: { refreshToken: rt2 } });
  check('reuse detection revoked the whole family', r.status === 401);
  r = await call('POST', '/api/users/login', { body: { email, password: pw } });
  check('login', r.status === 200, r.body);
  const at3 = r.body.accessToken;
  r = await call('POST', '/api/users/logout', { token: at3, body: {} });
  check('logout 204', r.status === 204);
  r = await call('GET', '/api/users/me', { token: at3 });
  check('logged-out access token rejected (Redis denylist)', r.status === 401, r.body);
  r = await call('POST', '/api/users/login', { body: { email, password: pw } });
  const at4 = r.body.accessToken;
  console.log('active sessions (Redis)');
  r = await call('POST', '/api/users/login', { body: { email, password: pw } });
  const atB = r.body.accessToken; const sidB = r.body.sessionId;
  r = await call('GET', '/api/users/me/sessions', { token: at4 });
  check('2 active sessions, 1 current', r.body.sessions.length === 2 && r.body.sessions.filter((x) => x.current).length === 1, r.body);
  check('session has device info (from Redis)', r.body.sessions.every((x) => x.device && x.createdAt), r.body);
  r = await call('DELETE', `/api/users/me/sessions/${sidB}`, { token: at4 });
  check('revoke other session 204', r.status === 204);
  r = await call('GET', '/api/users/me', { token: atB });
  check('revoked session access token rejected', r.status === 401, r.body);
  r = await call('GET', '/api/users/me', { token: at4 });
  check('current session still valid', r.status === 200, r.body);
  r = await call('DELETE', `/api/users/me/sessions/${sidB}`, { token: at4 });
  check('revoking unknown session 404', r.status === 404, r.body);

  r = await call('POST', '/api/users/me/password', { token: at4, body: { currentPassword: 'nope-nope', newPassword: 'another-pass-1' } });
  check('wrong current password 403', r.status === 403, r.body);
  r = await call('POST', '/api/users/me/password', { token: at4, body: { currentPassword: pw, newPassword: 'another-pass-1' } });
  check('password changed 204', r.status === 204);
  r = await call('GET', '/api/users/me', { token: at4 });
  check('password change signed out all sessions', r.status === 401, r.body);
  r = await call('POST', '/api/users/login', { body: { email, password: 'another-pass-1' } });
  check('login with new password', r.status === 200, r.body);
  const at5 = r.body.accessToken;
  r = await call('DELETE', '/api/users/me', { token: at5, body: { password: 'another-pass-1' } });
  check('delete account 204', r.status === 204);
  r = await call('POST', '/api/users/login', { body: { email, password: 'another-pass-1' } });
  check('deleted account cannot login', r.status === 401);

  await pool.end(); redis.disconnect();
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
