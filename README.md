# Bridge — Backend API

Revenue-share financing platform for Nigerian SMEs. Businesses raise capital from investors and repay automatically through revenue sweeps.

**Stack:** NestJS · Drizzle ORM · Neon (PostgreSQL) · Squad sandbox (payments) · OpenAI

**Interactive docs:** `http://localhost:3000/docs` once the server is running.

---

## Prerequisites

- Node.js 20+
- A [Neon](https://neon.tech) account (free tier works)
- A [Squad sandbox](https://sandbox.squadco.com) account
- An [OpenAI](https://platform.openai.com) API key

---

## 1. Clone and install

```bash
git clone https://github.com/tami-cp0/Bridge-Backend.git
cd Bridge-Backend
npm install
```

---

## 2. Configure environment variables

```bash
cp .env.example .env
```

Open `.env` and fill in every value:

| Variable | Where to get it |
|---|---|
| `DATABASE_URL` | Neon dashboard → your project → Connection string (pooled) |
| `JWT_SECRET` | Any random string, 32+ characters |
| `JWT_EXPIRES_IN` | Token lifetime, e.g. `7d` |
| `OPENAI_API_KEY` | platform.openai.com → API keys |
| `SQUAD_SECRET_KEY` | sandbox.squadco.com → Settings → API & Webhook tab |
| `SQUAD_BASE_URL` | Leave as `https://sandbox-api-d.squadco.com` |
| `SQUAD_MERCHANT_ID` | sandbox.squadco.com → Profile → your merchant ID |
| `SWEEP_TOLERANCE_PERCENT` | Leave as `2` |
| `MAX_DEAL_DURATION_MONTHS` | Leave as `24` |
| `MONO_PUBLIC_KEY` | app.mono.co → Apps → Public Key |
| `MONO_SECRET_KEY` | app.mono.co → Apps → Secret Key |
| `MONO_WEBHOOK_SECRET` | app.mono.co → Webhooks → Secret |
| `MONO_TEST_ACCOUNT_ID` | Account ID from successful connect widget code exchange |
| `FRONTEND_URL` | Frontend URL for CORS/redirects, e.g. `http://localhost:3001` |
| `PORT` | Local dev port, e.g. `3000` |

---

## 3. Push the database schema

```bash
npm run db:push
```

This syncs `src/db/schema.ts` directly to your Neon database. No migration files needed.

To inspect your data visually:

```bash
npm run db:studio
```

---

## 4. Database driver

The project uses `@neondatabase/serverless` in **WebSocket mode** (`Pool` + `drizzle-orm/neon-serverless`). This enables `db.transaction(tx => ...)` with real Postgres `BEGIN/COMMIT/ROLLBACK` semantics, which is required for the payout flow (ledger debit + payout row written atomically before the Squad API call).

The `ws` package provides the WebSocket constructor used by the Neon driver in Node.js environments.

---

## 5. How the escrow works

There is no separate "escrow account". Squad's merchant wallet **is** the escrow:
every payment into any virtual account we create lands in that one wallet. Per-user
ownership is tracked in the `internal_ledger_entries` table — credits when a user
deposits or receives a sweep distribution, debits when they invest, withdraw, or
contribute to a sweep. A user's spendable balance is `sum(credits) - sum(debits)`.

Capital tranches and payouts leave the escrow by calling Squad's `/payout/transfer`
to a real bank account (the `beneficiaryAccount` collected at signup).

---

## 6. Start the server

```bash
npm run start:dev
```

- API: `http://localhost:3000/api/v1`
- Swagger UI: `http://localhost:3000/docs`

---

## Project structure

```
src/
├── core/
│   ├── auth/           # Register business/investor, login
│   ├── bridge-rating/  # 6-component credit scoring (100-point scale)
│   ├── business/       # Business dashboard — profile, payments, stats, bank connect
│   ├── investments/    # Commit capital, tranche releases on funding
│   ├── investor/       # Investor dashboard — summary, wallet, deposit simulation
│   ├── ledger/         # Source of truth platform balance ledger service
│   ├── listings/       # Browse, create, dynamic 1-24m term calculator, AI profile
│   ├── mono/           # Mono Connect API integration and webhook income sync
│   ├── notifications/  # In-app notification state management
│   ├── payouts/        # Atomic ledger-backed bank transfers and requery API
│   ├── platform/       # Platform-wide stats for landing page
│   ├── scheduler/      # Cron job for overdue deal detection
│   ├── squad/          # Squad payment service wrapper (sandbox)
│   ├── sweep/          # Revenue sweep engine + Squad webhook idempotency handler
│   └── verification/   # CAC registration verification
├── config/             # Environment validation and Drizzle setup
└── db/                 # Drizzle ORM schema and Neon connection
```