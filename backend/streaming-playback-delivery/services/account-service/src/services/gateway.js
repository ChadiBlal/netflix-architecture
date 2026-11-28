// SIMULATED payment gateway (stand-in for Stripe/Adyen). No real money moves.
// Real systems would tokenize the card in the browser so PAN never touches our server.
//
// Test cards (any valid Luhn number):
//   ...0002  -> declined ("card_declined")
//   ...9995  -> declined ("insufficient_funds")
//   anything else -> approved
const crypto = require('crypto');

const brandOf = (n) => {
  if (/^4/.test(n)) return 'visa';
  if (/^(5[1-5]|2(2[2-9][1-9]|2[3-9]\d|[3-6]\d\d|7[01]\d|720))/.test(n)) return 'mastercard';
  if (/^3[47]/.test(n)) return 'amex';
  return 'card';
};

function luhn(n) {
  let sum = 0;
  let dbl = false;
  for (let i = n.length - 1; i >= 0; i--) {
    let d = Number(n[i]);
    if (dbl) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
    dbl = !dbl;
  }
  return sum % 10 === 0;
}

const tokenize = () => `tok_${crypto.randomBytes(12).toString('hex')}`;

async function charge({ method, amountCents }) {
  if (!method) return { ok: false, reason: 'no_payment_method' };
  const now = new Date();
  if (method.expYear < now.getUTCFullYear() || (method.expYear === now.getUTCFullYear() && method.expMonth < now.getUTCMonth() + 1)) {
    return { ok: false, reason: 'card_expired' };
  }
  if (method.last4 === '0002') return { ok: false, reason: 'card_declined' };
  if (method.last4 === '9995') return { ok: false, reason: 'insufficient_funds' };
  return { ok: true, reference: `ch_${crypto.randomBytes(10).toString('hex')}`, amountCents };
}

module.exports = { brandOf, luhn, tokenize, charge };
