# Implementation plan

## Product model

**Collection intermediary** — not property-management software.

| Step | What happens |
|------|----------------|
| 1 | Operator creates a group (building, school society, association) |
| 2 | Operator adds members and configures collection IBAN + committee bank |
| 3 | Operator posts monthly charges (split by area, equal, or weight) |
| 4 | Members pay by bank transfer; Revolut webhook matches payments |
| 5 | App holds matched funds until **Friday** |
| 6 | Cron transfers held balance to committee bank account |

## Phase 2 (planned)

| Feature | Description |
|---------|-------------|
| Owner portal | Signed-link pages: balance, QR, payment reference |
| Reports | PDF monthly summary and member statements |

**Out of scope:** AI invoice extraction, escalation engine, reserve fund tracker.

## Internal naming (hybrid)

- **UI / API:** groups, members, collections, payouts
- **Database:** `buildings`, `units` (unchanged)
