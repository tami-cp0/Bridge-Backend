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

## 6. Test the webhook (payment → sweep) flow

Squad fires a webhook when a business receives a payment. To simulate this locally:

**Expose your local server:**
```bash
npx ngrok http 3000
```

**Register the webhook URL in Squad sandbox dashboard:**

Settings → API & Webhook → Webhook URL:
```
https://<your-ngrok-id>.ngrok.io/api/v1/webhooks/squad
```

**Simulate an incoming payment (replace values with real sandbox VAs):**
```bash
curl -X POST https://sandbox-api-d.squadco.com/virtual-account/simulate/payment \
  -H "Authorization: Bearer <SQUAD_SECRET_KEY>" \
  -H "Content-Type: application/json" \
  -d '{ "virtual_account_number": "<business_va_number>", "amount": 500000 }'
```

This triggers the full sweep: revenue share is deducted, distributions flow to investors, Bridge Rating is recalculated.

---

## 7. Deploy to Vercel

```bash
npm install -g vercel
vercel
```

Add all `.env` variables under **Vercel dashboard → Settings → Environment Variables**.

After deploy, update the Squad sandbox webhook URL to:
```
https://<your-app>.vercel.app/api/v1/webhooks/squad
```

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

---

## Key concepts

| Concept | Detail |
|---|---|
| Amounts | All in **kobo** (1 NGN = 100 kobo) |
| BVN verification | Mocked — any 11-digit number is accepted |
| CAC verification | Mocked — sets `cacVerified: true` immediately |
| Squad | Sandbox only — no real money moves |
| Revenue sweep | On each incoming business payment, `revenueSharePercent` is swept and distributed pro-rata to investors |
| Bridge Rating | 100-point score across 6 components, recalculated after every sweep |
| Tranches | Capital disbursed in 3 tranches: tranche 1 on full funding, tranche 2 after 2nd sweep, tranche 3 after 4th sweep |
