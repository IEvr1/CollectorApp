# Cyprus Property Management Platform

Automation platform for Cyprus building management companies: expense distribution, Revolut payment matching, Twilio SMS + SendGrid email, operator dashboard with realtime ledger updates.

## Plan

The implementation plan lives at:

`C:\Users\User\.cursor\plans\cyprus_property_platform_195e52b3.plan.md`

## Project structure

```
PropertyManagementApp/
  backend/          FastAPI API
  frontend/         React + Vite + Tailwind operator UI
  supabase/migrations/
```

## Setup

### 1. Supabase

1. Create a [Supabase](https://supabase.com) project.
2. Run migrations in order in the SQL editor:
   - `supabase/migrations/001_core_schema.sql`
   - `supabase/migrations/002_operators_realtime.sql`
   - `supabase/migrations/003_indexes.sql`
3. Enable Email auth under Authentication → Providers.
4. Create an operator user, then insert into `operators`:

```sql
insert into operators (id, email, full_name)
values ('YOUR_AUTH_USER_UUID', 'you@example.com', 'Your Name');
```

### 2. Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate   # Windows
pip install -r requirements.txt
copy ..\.env.example .env   # fill in values
uvicorn app.main:app --reload --port 8000
```

Required env vars: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, `FRONTEND_URL`.

Optional for notifications: `TWILIO_*`, `SENDGRID_*`.  
Optional for payments:
- **Bank transfer:** `REVOLUT_WEBHOOK_SECRET` (Business API webhooks)
- **Payment links:** `REVOLUT_MERCHANT_API_KEY`, `REVOLUT_MERCHANT_WEBHOOK_SECRET` (Merchant API)

### 3. Frontend

```bash
cd frontend
npm install
```

Create `frontend/.env`:

```
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_API_URL=http://localhost:8000
```

```bash
npm run dev
```

Open http://localhost:5173 and sign in with your operator account.

## Payment reference format

Owners pay with reference:

```
{building_id}-{unit_id}-{YYYYMM}
```

Example: `a1b2c3d4-....-e5f6....-202605`

## Dual payment options

Owners can pay monthly charges in two ways:

1. **Bank transfer** — IBAN + payment reference (or QR). Revolut Business webhook matches incoming transfers.
2. **Payment link** — Revolut hosted checkout (Merchant API). Link is included in charge notices and available from the unit drawer.

## Revolut webhooks

| Product | URL |
|---------|-----|
| Business API (bank transfers) | `POST https://your-api.railway.app/webhooks/revolut` |
| Merchant API (payment links) | `POST https://your-api.railway.app/webhooks/revolut-merchant` |

Subscribe Merchant webhooks to `ORDER_COMPLETED` (and optionally `ORDER_AUTHORISED`).

## Railway deployment

Deploy `backend/` and `frontend/` as separate services. Set all env vars from `.env.example`. Schedule daily cron (Phase 2):

`GET /cron/escalation` with header `X-Cron-Secret`.

## MVP features

- Buildings & units CRUD
- Expense distribution with preview wizard
- Ledger per unit/month
- Dual payments: bank transfer + Revolut payment links
- Revolut webhooks (Business + Merchant)
- Twilio SMS + SendGrid email notifications
- Realtime dashboard updates
- QR payment codes per unit

## Phase 2 (planned)

AI invoice extraction, 6-level escalation cron, reserve fund, PDF reports, owner portal with signed links.
