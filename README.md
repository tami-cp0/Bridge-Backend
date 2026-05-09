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
| `SQUAD_ESCROW_ACCOUNT` | See step 4 |
| `SWEEP_TOLERANCE_PERCENT` | Leave as `2` |
| `MAX_DEAL_DURATION_MONTHS` | Leave as `24` |

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

## 4. Create the Squad escrow account

The platform needs a dedicated virtual account to hold investor funds before distributing them to investors after sweeps.

1. Log in to [sandbox.squadco.com](https://sandbox.squadco.com)
2. Go to **Virtual Accounts** → create a new one (name it anything, e.g. "Bridge Escrow")
3. Copy the virtual account number Squad generates
4. Set `SQUAD_ESCROW_ACCOUNT=<that number>` in your `.env`

---

## 5. Start the server

```bash
npm run start:dev
```

- API: `http://localhost:3000/api/v1`
- Swagger UI: `http://localhost:3000/docs`

---

## Project structure

```
src/
├── auth/           # Register business/investor, BVN verify, login
├── business/       # Business dashboard — profile, payments, sweep summary
├── investor/       # Investor dashboard — summary, wallet, deals
├── listings/       # Browse, create, term calculator, AI-generated profile
├── investments/    # Commit capital, tranche releases on funding
├── sweep/          # Revenue sweep engine + Squad webhook handler
├── bridge-rating/  # 6-component credit scoring (100-point scale)
├── squad/          # Squad payment service wrapper (sandbox)
├── platform/       # Platform-wide stats for landing page
├── notifications/  # In-app notification read/unread
├── verification/   # CAC registration verification
├── scheduler/      # Cron job for overdue deal detection
└── db/             # Drizzle ORM schema and Neon connection
```