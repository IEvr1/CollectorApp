# Cyprus Property Management Platform

Automation platform for Cyprus building management companies: expense distribution, Revolut payment matching, Twilio SMS + SendGrid email, operator dashboard with ledger updates.

## Project structure

```
PropertyManagementApp/
  backend/          FastAPI API (Vercel serverless)
  frontend/         React + Vite + Tailwind operator UI
  db/migrations/    Neon Postgres schema
  public/           Built frontend (generated at deploy)
  scripts/build.py  Vercel build — compiles frontend into public/
```

## Setup

### 1. Database (Neon via Vercel)

1. Link the repo to Vercel: `vercel link`
2. Add Neon Postgres: `vercel integration add neon`
3. Pull env vars locally: `vercel env pull .env.local`
4. Run migrations against your database:

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate   # Windows
pip install -r requirements.txt
python scripts/migrate.py
```

5. Create an operator account:

```bash
python scripts/create_operator.py you@example.com your-password "Your Name"
```

### 2. Local development

**Backend** (from `backend/`):

```bash
pip install -r requirements.txt
copy ..\.env.local ..\.env   # or use .env.local at repo root
uvicorn app.main:app --reload --port 8000
```

**Frontend** (from `frontend/`):

```bash
npm install
copy .env.example .env
npm run dev
```

Open http://localhost:5173 and sign in with your operator account.

Alternatively, run the full stack as on Vercel:

```bash
vercel dev
```

### 3. Required environment variables

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Neon Postgres connection string |
| `JWT_SECRET` | Signs operator login tokens |
| `CRON_SECRET` | Protects scheduled payout endpoint |

See `.env.example` for Revolut, Twilio, and SendGrid options.

## Vercel deployment

1. Push to GitHub and import the repo in [Vercel](https://vercel.com/new).
2. Vercel detects the FastAPI entrypoint via `pyproject.toml` (`backend/server:app`).
3. The build script compiles the React app into `public/` for static hosting.
4. API routes live under `/api/*` (single FastAPI serverless function).
5. Add env vars in the Vercel dashboard (or `vercel env add`).
6. Enable the Neon integration for `DATABASE_URL`.

**Cron:** Weekly payout runs Fridays at 04:00 UTC via `vercel.json` → `GET /api/cron/weekly-payout`. Vercel sends `Authorization: Bearer <CRON_SECRET>` — set `CRON_SECRET` in project env.

**Webhooks:** Configure Revolut Business to POST to:

```
https://your-app.vercel.app/api/webhooks/revolut
```

## Payment reference format

Owners pay with reference:

```
{building_id}-{unit_id}-{YYYYMM}
```

Example: `a1b2c3d4-....-e5f6....-202605`

## Payment method

Owners pay monthly charges via **bank transfer** — IBAN + payment reference (or SEPA QR code). Revolut Business webhook matches incoming transfers.

## MVP features

- Buildings & units CRUD
- Expense distribution with preview wizard
- Ledger per unit/month
- Bank transfer payments via Revolut Business webhooks
- Weekly automated payouts to committee BoC accounts
- Revolut Business API integration
- Twilio SMS + SendGrid email notifications
- Dashboard polling updates (10s refresh)
- QR payment codes per unit

## Phase 2 (planned)

AI invoice extraction, 6-level escalation cron, reserve fund, PDF reports, owner portal with signed links.
