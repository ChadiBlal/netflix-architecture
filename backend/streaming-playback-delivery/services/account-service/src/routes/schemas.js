const { z } = require('zod');
const { luhn } = require('../services/gateway');

const email = z.string().trim().toLowerCase().email().max(254);
const password = z.string().min(8, 'Password must be at least 8 characters').max(72);
const country = z.string().trim().length(2).toUpperCase();

const digits = (s) => s.replace(/[\s-]/g, '');
const thisYear = () => new Date().getUTCFullYear();

module.exports = {
  register: z.object({ email, password, fullName: z.string().trim().min(1).max(80), country: country.optional() }),
  login: z.object({ email, password: z.string().min(1).max(72) }),
  refresh: z.object({ refreshToken: z.string().min(20) }),
  logout: z.object({ refreshToken: z.string().min(20).optional() }),
  updateMe: z.object({ fullName: z.string().trim().min(1).max(80).optional(), country: country.optional() })
    .refine((v) => Object.keys(v).length > 0, 'Nothing to update'),
  changePassword: z.object({ currentPassword: z.string().min(1), newPassword: password }),
  deleteAccount: z.object({ password: z.string().min(1) }),

  profileCreate: z.object({
    name: z.string().trim().min(1).max(30),
    avatar: z.string().trim().max(100).optional(),
    isKids: z.boolean().optional(),
  }),
  profileUpdate: z.object({
    name: z.string().trim().min(1).max(30).optional(),
    avatar: z.string().trim().max(100).optional(),
    isKids: z.boolean().optional(),
  }).refine((v) => Object.keys(v).length > 0, 'Nothing to update'),

  subscribe: z.object({ planCode: z.string().min(1), paymentMethodId: z.string().uuid().optional() }),
  changePlan: z.object({ planCode: z.string().min(1) }),
  addMethod: z.object({
    number: z.string().transform(digits).refine((n) => /^\d{13,19}$/.test(n) && luhn(n), 'Invalid card number'),
    cvc: z.string().regex(/^\d{3,4}$/, 'Invalid CVC'), // validated then discarded, never stored
    expMonth: z.coerce.number().int().min(1).max(12),
    expYear: z.coerce.number().int().min(thisYear()).max(thisYear() + 20),
    holderName: z.string().trim().min(1).max(80),
    makeDefault: z.boolean().optional(),
  }).refine((v) => v.expYear > thisYear() || v.expMonth >= new Date().getUTCMonth() + 1, {
    message: 'Card has expired', path: ['expMonth'],
  }),
  sidParam: z.object({ sid: z.string().uuid() }),
  idParam: z.object({ id: z.string().uuid() }),
  pagination: z.object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
    offset: z.coerce.number().int().min(0).default(0),
  }),
};
