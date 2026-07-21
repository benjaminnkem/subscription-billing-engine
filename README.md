# Subflow · Monnify Subscription Engine

Multi-tenant **subscription billing engine** for African merchants. Subflow sits on [Monnify](https://monnify.com) as the payments rail and delivers the full subscription stack: plans, checkout, tokenized renewals, dunning, webhooks, analytics, customer portal, and live event observability (Mission Control).

> **One line:** Plans, Monnify checkout, renewals, recovery, and ops visibility, not just a pay button.

---

## Features

| Area | What you get |
|------|----------------|
| **Merchants & auth** | Multi-tenant signup/login, JWT access/refresh, API keys |
| **Catalog** | Plans (intervals, trials), customers, metadata |
| **Subscriptions** | Lifecycle: pending → active / trial / past due / suspended / cancelled |
| **Billing** | Invoices, proration helpers, recurring charge path |
| **Payments (Monnify)** | Hosted checkout, card-token charges, webhook activation |
| **Dunning** | Failed-payment retries and recovery flows |
| **Portal** | Magic-link customer self-serve (plan, pause, cancel, invoices) |
| **Ops** | Analytics metrics, Mission Control event stream, chaos scenarios |
| **Integrations** | Outbound merchant webhooks, email notifications, recovery channels |

Companion **merchant dashboard** (Next.js) lives in the `subscription-engine-dashboard` repo and talks to this API.

---

## Stack

- **Runtime:** NestJS 11, TypeScript  
- **Data:** PostgreSQL + TypeORM  
- **Queues / realtime:** Redis, BullMQ, Socket.IO  
- **Payments:** Monnify REST API (sandbox or live)  
- **Docs:** Swagger at `/docs`  

---

## Architecture (high level)

```
Merchant Dashboard  ──JWT──►  Subflow API (this repo)
Customer Portal     ──token─►  /portal/*
Monnify Checkout    ──pay──►  Monnify
Monnify Webhooks    ──POST─►  /webhooks/monnify
```

**Typical first-payment flow**

1. Merchant creates plan + customer + subscription.  
2. API creates invoice + payment and calls Monnify **init-transaction**.  
3. Customer pays on Monnify hosted checkout.  
4. Monnify sends `SUCCESSFUL_TRANSACTION` to `/webhooks/monnify`.  
5. API verifies signature, marks payment/invoice paid, activates subscription, optionally stores card token for renewals.

---

## Monnify integration

### Outbound (API → Monnify)

| Purpose | Method | Path |
|---------|--------|------|
| Auth / access token | `POST` | `/api/v1/auth/login` |
| Checkout (init transaction) | `POST` | `/api/v1/merchant/transactions/init-transaction` |
| Tokenized charge | `POST` | `/api/v1/merchant/cards/charge-card-token` |
| Query transaction | `GET` | `/api/v2/merchant/transactions/query` |
| List banks | `GET` | `/api/v1/sdk/transactions/banks` |
| Validate account | `GET` | `/api/v1/disbursements/account/validate` |

Base URL:

- Sandbox: `https://sandbox.monnify.com`  
- Live: `https://api.monnify.com`  

### Inbound (Monnify → API)

| Purpose | Method | Path |
|---------|--------|------|
| Payment webhooks | `POST` | `/webhooks/monnify` |

Signature verification uses **HMAC-SHA512** of the raw body with `MONNIFY_SECRET_KEY` (legacy concat SHA-512 is also accepted). Configure the Transaction Completion webhook in the Monnify dashboard to:

```text
https://<your-api-host>/webhooks/monnify
```

---

## Prerequisites

- Node.js 20+  
- [pnpm](https://pnpm.io)  
- PostgreSQL  
- Redis  

---

## Quick start

```bash
pnpm install
cp .env.example .env   # or create .env from the table below
# ensure Postgres + Redis are running, then:
pnpm run start:dev
```

- API: `http://localhost:<PORT>` (default `3000`, often `6555` in local `.env`)  
- Swagger: `http://localhost:<PORT>/docs`  

---

## Environment variables

| Variable | Description |
|----------|-------------|
| `NODE_ENV` | `development` \| `production` |
| `PORT` | HTTP port |
| `APP_NAME` | Display name (default `Subflow`) |
| `APP_URL` | Public API base URL |
| `DASHBOARD_URL` | Merchant dashboard URL (portal magic links) |
| `CORS_ORIGINS` | Comma-separated allowed origins |
| **Database** | |
| `DB_HOST` / `DB_PORT` / `DB_USERNAME` / `DB_PASSWORD` / `DB_NAME` | Postgres connection |
| **Redis** | |
| `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD` / `REDIS_URL` | Queue + cache |
| **Auth** | |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | JWT signing |
| `JWT_ACCESS_EXPIRY` / `JWT_REFRESH_EXPIRY` | e.g. `15m`, `7d` |
| `ENCRYPTION_KEY` | 32-byte key for sensitive fields |
| **Monnify** | |
| `MONNIFY_API_URL` | Sandbox or live base URL |
| `MONNIFY_API_KEY` | API key from dashboard |
| `MONNIFY_SECRET_KEY` | Client secret (API auth + webhook HMAC) |
| `MONNIFY_CONTRACT_CODE` | Required for checkout + token charges |
| `MONNIFY_WEBHOOK_SECRET` | Optional; verification prefers secret key |
| `MONNIFY_SUB_ACCOUNT_ID` | Optional split/sub-account |
| **Mail** | |
| `MAIL_ENABLED` / `MAIL_HOST` / `MAIL_PORT` / `MAIL_USER` / `MAIL_PASSWORD` | SMTP (e.g. Brevo) |
| `MAIL_FROM_NAME` / `MAIL_FROM_ADDRESS` | From header |

In development, TypeORM `synchronize` may be enabled. Prefer migrations for shared/production databases.

---

## Scripts

```bash
pnpm run start:dev    # watch mode
pnpm run build        # compile to dist/
pnpm run start:prod   # run dist/main
pnpm run test         # unit tests
pnpm run test:e2e     # e2e tests
pnpm run lint         # ESLint
```

---

## Key modules (`src/`)

| Module | Role |
|--------|------|
| `auth` / `merchants` | Signup, JWT, merchant profile |
| `plans` / `customers` / `subscriptions` | Catalog + lifecycle |
| `invoices` / `billing` / `payments` | Invoicing + Monnify |
| `dunning` / `recovery-channels` | Failed payment recovery |
| `portal` | Customer magic-link portal API |
| `analytics` | Metrics for dashboard |
| `events` | Domain events + Mission Control stream |
| `webhooks` | Outbound merchant webhooks |
| `chaos` | Non-prod payment/webhook failure injection |
| `mail` / `notifications` | Email and notification delivery |

---

## Core API surface (summary)

Authenticated routes use `Authorization: Bearer <access_token>`.

| Area | Examples |
|------|----------|
| Auth | `POST /auth/signup`, `POST /auth/login` |
| Plans / customers / subscriptions | CRUD under `/plans`, `/customers`, `/subscriptions` |
| Payments | `POST /payments/checkout`, `GET /payments` |
| Monnify webhooks | `POST /webhooks/monnify` (public) |
| Portal | `POST /portal/login`, `GET /portal/session`, `POST /portal/session/action` |
| Analytics | `/analytics/*` |
| Mission Control | Events over HTTP + Socket.IO |

Full contract: **Swagger** at `/docs`.

---

## Webhook & local development

1. Expose the API publicly (e.g. ngrok / Cloudflare Tunnel).  
2. Point Monnify Transaction Completion URL to `https://<tunnel>/webhooks/monnify`.  
3. Use sandbox keys + contract code.  
4. After a test payment, confirm:
   - payment status `succeeded`
   - invoice `paid`
   - subscription `active`
   - event visible in Mission Control (dashboard)

Signature verification needs the **raw body** (`rawBody: true` is enabled in `main.ts`).

---

## Related repos

| Repo | Role |
|------|------|
| **monnify-subscription-engine** (this) | NestJS API + Monnify integration |
| **subscription-engine-dashboard** | Merchant dashboard, landing page, customer portal UI |

---

## License

UNLICENSED / private unless otherwise specified by the project owners.
