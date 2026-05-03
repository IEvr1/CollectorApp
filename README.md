# Beauty Salon Booking MVP

QR -> chat booking flow for a single salon app, with multi-staff scheduling and SMS manage links.

## Features included

- ChatGPT-like booking page with card/list selectors for service, staff, and time.
- Booking API that requires name + phone before confirmation.
- SMS confirmation flow with deep link token (`/r/:token`) for returning users.
- Simple manager dashboard table for all bookings across staff.
- Prisma schema covering salons, services, staff, availability, customers, bookings, sessions, and SMS tokens.

## Setup

0. Create a PostgreSQL database (local or hosted) and set `DATABASE_URL` in `.env`.

1. Install dependencies:

```bash
npm install
```

2. Copy environment file:

```bash
copy .env.example .env
```

3. Run database migration:

```bash
npx prisma migrate dev --name init
```

4. Generate Prisma client:

```bash
npx prisma generate
```

5. Start app:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Pages

- `/` landing page
- `/chat` customer booking chat
- `/dashboard` manager booking table (HTTP Basic: set `DASHBOARD_AUTH_SECRET`; optional `DASHBOARD_AUTH_USER`, default `manager`)
- `/r/:token` returning customer deep-link resolver

## Notes

- UI language defaults to Greek, with optional English via `?lang=en` and in-page language switch.
- Business locale defaults to Cyprus (`Europe/Nicosia` timezone).
- Booking accepts Cyprus mobile numbers only (`+3579XXXXXXX` or local `9XXXXXXX`) to ensure SMS deliverability.
- Twilio sender can be either `TWILIO_ALPHA_SENDER_ID` (preferred when supported) or `TWILIO_PHONE_NUMBER`.
- If Twilio credentials or sender are not set, SMS is logged to server console (dev fallback).
- Google Calendar integration:
  - Set `GOOGLE_SERVICE_ACCOUNT_EMAIL` and `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` in `.env`.
  - Share each staff calendar with the service account email.
  - Save each staff calendar ID in `Staff.calendarId` (e.g. `aisha@group.calendar.google.com`).
  - Quick assign command:
    - `npm run set:staff-calendars -- "Aisha=aisha@group.calendar.google.com" "Mona=mona@group.calendar.google.com" "Sara=sara@group.calendar.google.com"`
  - Availability excludes busy ranges from each staff calendar, and confirmed bookings create events in that same calendar.
- Reminder policy:
  - If appointment is less than 2h30m away, no reminder is sent.
  - If appointment is from 2h30m to less than 24h away, one reminder is sent at 2h30m before.
  - If appointment is 24h+ away, two reminders are sent (24h before and 2h30m before).
- Trigger reminders via `POST /api/reminders/dispatch` (call from cron). In **production**, `REMINDER_DISPATCH_SECRET` is **required**; send it as header `x-reminder-secret` or as `Authorization: Bearer <secret>`. On Vercel, you can align `REMINDER_DISPATCH_SECRET` with project `CRON_SECRET` so scheduled invocations are authorized automatically.
- `vercel.json` includes a cron schedule `0,45 * * * *` to run reminder checks at minute 0 and 45 every hour.
- In **production**, set `SMS_LINK_SECRET` for signing deep-link JWTs (the app refuses to start token signing without it).
- Seed data is inserted automatically when API/pages run for the first time.
