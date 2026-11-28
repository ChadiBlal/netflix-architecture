# Account & Billing Service

Node.js + Express, port **5001**. Reached through Zuul at `http://localhost:8080/api/users/**`
(Zuul forwards the path unchanged, so every route below starts with `/api/users`).

- **PostgreSQL** (ACID): users, profiles, subscriptions, payment methods, payments, refresh tokens
- **Redis** (shared cache, per the architecture diagram):
  - **Active sessions** `session:<userId>:<sid>` (device, IP, created/last seen; TTL = refresh lifetime)
  - Entitlement cache `entitlement:<userId>` (60 s, read-through from Postgres)
  - Revocation markers `deny:<jti>` and `deny:sid:<sid>`
  - Redis is a cache: if it is down the service still works (sessions are enforced from Postgres).
- **Payments are SIMULATED** (`src/services/gateway.js`). No real money moves and card numbers/CVC are never stored (only brand, last4, expiry, and a fake token).

## Run

```bash
# 1. database (once)
psql -U postgres -c "CREATE DATABASE netflix;"
psql -U postgres -d netflix -f databases/postgresql_schema.sql

# 2. service
cd services/account-service
cp .env.example .env        # set DATABASE_URL password + JWT_SECRET
npm install
npm start                   # http://localhost:5001/health
npm run smoke               # 61 end-to-end checks (add BASE_URL=http://localhost:8080 to go through Zuul)
```

## API

Auth: `Authorization: Bearer <accessToken>` (15 min). Errors: `{ "error": { "code", "message", "details?" } }`.

| Method & path | Auth | Purpose |
|---|---|---|
| `POST /api/users/register` | - | `{email, password, fullName, country?}` -> user + tokens (creates a default profile) |
| `POST /api/users/login` | - | `{email, password}` -> user + tokens |
| `POST /api/users/refresh` | - | `{refreshToken}` -> new tokens (rotation; replaying an old token revokes all sessions) |
| `POST /api/users/logout` | yes | ends the current session (this device) |
| `GET /api/users/me/sessions` | yes | active sessions / devices, `current: true` marks this one |
| `DELETE /api/users/me/sessions/:sid` | yes | sign out one device |
| `DELETE /api/users/me/sessions` | yes | sign out all OTHER devices |
| `GET/PATCH /api/users/me` | yes | profile of the account |
| `POST /api/users/me/password` | yes | `{currentPassword, newPassword}` (signs out everywhere) |
| `DELETE /api/users/me` | yes | `{password}` soft-deletes + anonymises; subscription ended; payments kept |
| `GET/POST /api/users/me/profiles` | yes | list / create (max 5) |
| `PATCH/DELETE /api/users/me/profiles/:id` | yes | rename / delete (not the last one) |
| `GET /api/users/plans` | - | Basic / Standard / Premium |
| `GET /api/users/me/subscription` | yes | current (or last) subscription, `status: none` if never subscribed |
| `POST /api/users/me/subscription` | yes | `{planCode, paymentMethodId?}` charges first month |
| `PATCH /api/users/me/subscription` | yes | `{planCode}` upgrade = immediate + prorated charge; downgrade = at next renewal |
| `DELETE /api/users/me/subscription` | yes | cancel at period end (access continues until then) |
| `POST /api/users/me/subscription/resume` | yes | undo a cancellation |
| `GET /api/users/me/entitlement` | yes | `{entitled, plan, maxStreams, maxResolution, ...}` for the Playback service |
| `GET/POST /api/users/me/payment-methods` | yes | list / add card `{number, cvc, expMonth, expYear, holderName, makeDefault?}` |
| `PUT /api/users/me/payment-methods/:id/default` | yes | set default |
| `DELETE /api/users/me/payment-methods/:id` | yes | remove |
| `GET /api/users/me/payments?limit&offset` | yes | payment history (paid and failed) |
| `GET /api/users/me/payments/:id` | yes | one payment |
| `GET /api/users/health` | - | Postgres / Redis status |

### Billing rules
- One live subscription per user (enforced by a partial unique index, safe under concurrent requests).
- Monthly renewal by a background worker (`RENEWAL_INTERVAL_MS`, or `npm run renew`). Failed renewal -> `past_due`,
  retried once a day for `PAST_DUE_GRACE_DAYS` (7), access continues during grace, then `expired`.
- Every charge attempt, successful or not, produces a payment (`PAY-00000001`...).
- Demo a renewal without waiting a month: `node scripts/run-renewals.js 2027-01-01`.

### Test cards (any expiry in the future, any CVC)
| Number | Result |
|---|---|
| `4242 4242 4242 4242` | approved (Visa) |
| `5555 5555 5555 4444` | approved (Mastercard) |
| `4000 0000 0000 0002` | declined (`card_declined`) |
| `4000 0000 0000 9995` | declined (`insufficient_funds`) |

### Using it from the Playback service
Verify the same JWT (`JWT_SECRET`, HS256, `sub` = user id) and read `entitlement:<userId>` from Redis,
or call `GET /api/users/me/entitlement` with the user's token, to decide whether to allow streaming.

### Layout
```
src/
  routes/        HTTP + validation (zod)
  services/      business logic (auth, billing, entitlement, simulated gateway)
  repositories/  ALL SQL lives here
  middleware/    auth, error handling
scripts/         smoke.js, run-renewals.js
```
