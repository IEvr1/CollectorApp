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

Open [http://localhost:3002](http://localhost:3002).

## Pages

- `/` public booking link; redirects straight to `/chat`
- `/chat` customer booking chat
- `/dashboard?code=...` manager booking table via signed business link. Generate a 90-day link with `npm run dashboard:link`.
- `/r/:token` returning customer deep-link resolver
- The dashboard includes PWA install metadata and an in-page install button when Chrome exposes the install prompt.

## Notes

- UI language defaults to Greek, with optional English via `?lang=en` and in-page language switch.
- Business locale defaults to Cyprus (`Europe/Nicosia` timezone).
- Booking accepts Cyprus mobile numbers as **8 digits** without `+357` (e.g. `99XXXXXX`, `96XXXXXX`); they are stored/SMS-sent as `+357…`. Twilio `From`: tries **`TWILIO_ALPHA_SENDER_ID` first** when both it and **`TWILIO_PHONE_NUMBER`** are set; if Twilio returns **21212**, the app **retries with the phone number**. Optional `TWILIO_MESSAGING_SERVICE_SID` overrides both when set.
- If Twilio credentials or sender are not set, SMS is logged to server console (dev fallback).
- Google Calendar integration:
  - Set `GOOGLE_SERVICE_ACCOUNT_EMAIL` and `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` in `.env`.
  - Share each staff calendar with the service account email.
  - Save each staff calendar ID in `Staff.calendarId` (e.g. `aisha@group.calendar.google.com`).
  - Quick assign command:
    - `npm run set:staff-calendars -- "Aisha=aisha@group.calendar.google.com" "Mona=mona@group.calendar.google.com" "Sara=sara@group.calendar.google.com"`
  - Availability excludes busy ranges from each staff calendar, and confirmed bookings create events in that same calendar.
- Reminder policy:
  - Reminders are sent in a daily morning batch at 07:30 salon-local time.
  - Confirmed appointments can receive one reminder on the appointment day only.
  - If the 07:30 reminder time for a booking has already passed, that reminder is not scheduled.
- Trigger reminders via `GET` or `POST /api/reminders/dispatch` (Vercel Cron uses **GET**). In **production**, **`REMINDER_DISPATCH_SECRET`** is **required** (otherwise dispatch returns 401). Set **`CRON_SECRET`** in Vercel so cron sends `Authorization: Bearer <CRON_SECRET>` (often the same value as `REMINDER_DISPATCH_SECRET`). Manual calls can use `x-reminder-secret` or `Authorization: Bearer` with either secret. In local dev, if neither secret is set, the route stays **unauthenticated** for convenience.
- `vercel.json` includes a Hobby-compatible daily cron schedule `30 4 * * *` (UTC) to run the morning reminder batch. Vercel Cron is UTC-only; for Cyprus this matches 07:30 during daylight saving time, and dispatch uses a short lookahead so standard-time reminders are still caught.
- **`APP_BASE_URL`**: set this to the real public app URL in production, for example `https://your-real-project.vercel.app`. SMS links use this unless **`SMS_LINK_BASE_URL`** is set. Do not leave either value as a placeholder such as `https://your-vercel-app.vercel.app`.
- **`DASHBOARD_LINK_SECRET`**: signs business dashboard links. Run `npm run dashboard:link` to print a `/dashboard?code=...` URL valid for 90 days. Opening that URL stores an httpOnly dashboard cookie and redirects to `/dashboard` without showing the code. In production this secret is required for dashboard access; `/` and `/chat` stay public.
- **`SMS_LINK_SECRET`**: required in **production** for signing deep-link JWTs in SMS; keep it stable across deploys or old links break.
- Seed data is inserted automatically when API/pages run for the first time.
