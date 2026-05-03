# DECISIONS — Salon Booking MVP

Ενημέρωσε αυτό το αρχείο στο τέλος κάθε session (τι ολοκληρώθηκε, τι μένει, σημειώσεις). Λεπτομέρειες setup και policies: [README.md](README.md).

---

## Current Status

- Landing `/`, booking chat `/chat`, manager table `/dashboard`, επιστροφή πελάτη `/r/:token`.
- Booking flow: επιλογή υπηρεσίας / staff / ώρας, API κράτησης με όνομα + τηλέφωνο πριν την επιβεβαίωση.
- SMS επιβεβαίωση με deep link· Twilio ή console fallback αν λείπουν credentials/sender.
- Prisma: salon, services, staff, availability, customers, bookings, sessions, SMS tokens.
- UI: ελληνικά default, `?lang=en`· ζώνη `Europe/Nicosia`· κινητά Κύπρου (`+3579…` ή `9…`).
- Google Calendar: busy exclusion + events για confirmed bookings (service account + `Staff.calendarId`).
- Υπενθυμίσεις: πολιτική στο README· `POST /api/reminders/dispatch`· cron στο `vercel.json` (λεπτά 0 και 45).
- Seed δεδομένων αυτόματα στην πρώτη χρήση API/σελίδων.

---

## Current Focus

_(συμπλήρωσε — μία εργασία σε εξέλιξη, π.χ. «φίλτρα dashboard»)_

---

## Next Steps

- [ ] **1.** Φίλτρα στο dashboard — ημερομηνία (default σήμερα), staff, υπηρεσία, status· query params server-side (όχι πάντα take 100).
- [ ] **2.** Αναζήτηση με τηλέφωνο — φίλτρο σε `phoneE164` (προαιρετικά partial match).
- [ ] **3.** Ακύρωση ραντεβού — UI + API, `BookingStatus.CANCELLED`, συγχρονισμός Google event όπου ισχύει.
- [ ] **4.** Προβολή σημερινών ανά staff — grouped UI χωρίς αλλαγή schema.
- [ ] **5.** Επαναπρογραμματισμός — νέα slot (λογική διαθεσιμότητας όπως στο chat) + ενημέρωση calendar event.

**Μετά τα 5 (προαιρετικό):** απλή προστασία `/dashboard` (shared secret / `src/proxy.ts`) αν το deploy είναι δημόσιο.

---

## Notes

- **Env (ονόματα μόνο, όχι τιμές):** `DATABASE_URL`, Twilio (`TWILIO_*`), `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`, `REMINDER_DISPATCH_SECRET`.
- **Εντολές:** `npm install`, `npx prisma migrate dev`, `npx prisma generate`, `npm run dev`, `npm run set:staff-calendars -- "Name=calendarId" ...`
- **API:** `POST /api/bookings`, `POST /api/chat/message`, `POST /api/reminders/dispatch` (header `x-reminder-secret` αν έχει οριστεί secret).

---

## Project structure

Η διάταξη είναι σκόπιμα απλή (Next.js App Router)· χωρίς `features/`, `domain/`, ή monorepo packages για αυτό το MVP.

```text
Salon_booking/
├── prisma/                 # schema + migrations μόνο
├── scripts/                # one-off CLI (π.χ. set-staff-calendars)
├── public/                 # στατικά assets
├── src/
│   ├── app/                # routes: page.tsx, layout, api/.../route.ts
│   └── lib/                # κοινή server λογική (Prisma, SMS, booking, κλπ.)
├── package.json
├── next.config.ts
├── vercel.json
└── README.md
```

**Αρχές**

- Routes & HTTP μόνο σε `src/app/` (`page.tsx`, `route.ts`).
- Κοινή λογική σε `src/lib/` — ένα αρχείο ≈ ένα θέμα· νέο αρχείο όταν το concern είναι ξεκάθαρα ξεχωριστό.
- Components inline στο `page.tsx` όσο τα αρχεία μένουν διαχειρίσιμα· `src/components/` μόνο αν χρειάζεται επαναχρησιμοποίηση ή μεγάλο αρχείο.
- DB μόνο μέσω Prisma στο `prisma/`· migrations committed.

---

## Naming

- **Lib αρχεία:** `kebab-case.ts` (π.χ. `google-calendar.ts`, `deep-link-token.ts`).
- **API paths:** πόρος + HTTP method + body semantics — π.χ. `POST /api/bookings`, `POST /api/chat/message`.
- **Συναρτήσεις:** `verbNoun` (π.χ. `ensureSalonSeed`, `dispatchReminders`).
- **Prisma models:** PascalCase singular (`Booking`, `Staff`).

## 

MVP: Τι να κρατήσεις / τι να κόψεις
Κράτα (must-have):

service/staff/date/time selection σε mobile-friendly UI
booking confirmation με SMS
manage/reschedule/cancel από deep link (/r/:token)
basic dashboard για ιδιοκτήτη (ημέρα, staff, status)
σύγκρουση ραντεβού + κανόνες διαθεσιμότητας

Κόψε για αργότερα (nice-to-have):
πλήρες AI chat/NLU
loyalty program
advanced analytics
multi-branch / franchise complex features
πολύπλοκα roles/permissions

Προτεινόμενο Positioning (για να μη μοιάζει “άλλο ένα”)
“Book in 30 seconds from WhatsApp/SMS.”
“Fewer no-shows, fuller calendars.”
“Built for small salons, not enterprise chains.”

30-ημερών Go-to-Market πλάνο (lean)
Εβδομάδα 1: 3 pilot salons, δωρεάν onboarding, baseline metrics (bookings/week, no-show %)
Εβδομάδα 2: reminders + one-tap reschedule, μέτρηση impact
Εβδομάδα 3: waitlist/cancellation fill, μικρές UX βελτιώσεις από feedback
Εβδομάδα 4: paid pilot (χαμηλό monthly), case study με 1-2 salons

KPI που έχουν νόημα από νωρίς
booking completion rate
no-show rate
reschedule success rate
time-to-book (δευτερόλεπτα)
repeat customer booking rate


Database & Prisma:

npx prisma migrate dev --name init
npx prisma generate

production-style run

npm run build
npm run start