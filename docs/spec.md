## Calendar MBA — Product & UX Blueprint

### Goals
- Installable PWA (offline-first) to track debts, credits, and cashflow with quick capture and payoff guidance.
- “Access anywhere”: Supabase auth + Postgres; sync when online; graceful offline states.
- Home = upcoming 15 days, calendar, snapshot; fast actions: mark paid, edit, snooze, add entry.

### User Roles & Auth
- Single user per workspace; Supabase email/OTP auth.
- Session stored with Supabase client; refresh tokens via built-in flow.
- Offline: cache last successful user payload (occurrences, debts, transactions) in IndexedDB; queue writes.

### Screens (MVP)
- **Dashboard**
  - Next 15 days list (status chips: Scheduled/Paid/Partial/Skipped/Missed).
  - Calendar month view with colored dots (red debt, green credit, grey other). Date click → side sheet/modal: items + Add entry.
  - Snapshot: cash on hand (optional manual), upcoming 30d debit vs credit, remaining debt balance, “Pay-first recommendation” card.
  - Quick actions on list rows: Mark Paid, Edit, Snooze (push due date by +1/+3/+7).
- **Add Entry (modal/sheet)**
  - Fields: name, type (Debt/Credit), category, amount, due date, recurrence (none/weekly/fortnightly/monthly/yearly, interval, end date/occurrences).
  - Debt-only extras: total balance, APR, minimum payment, lender/account, priority lock, notes, attachment.
  - Actions: Save; Save & Add Another; Mark as already paid.
- **Debt Accounts**
  - List cards showing balance, APR, min payment, due day, payoff strategy eligibility.
  - Detail: payment history, schedule, ability to regenerate schedule.
- **Analytics**
  - Monthly totals: income vs expenses vs debt payments.
  - Rolling 30-day cashflow.
  - Category breakdown.
  - Payoff recommendations: avalanche/snowball order, extra payment slider showing payoff date + interest saved (if APR/balance present).
- **Alerts**
  - Upcoming due (3d/1d), missed payment, low cash forecast (upcoming debits > expected credits).

### Architecture (recommended)
- Frontend: Next.js App Router + Tailwind; PWA manifest + service worker (Workbox) for offline + caching API responses; IndexedDB via Dexie for offline queue.
- Backend: Next.js API routes (start) or FastAPI if you prefer; Supabase DB for persistence + Auth; Supabase edge functions optional for scheduled jobs (occurrence generation, notifications).
- Sync: optimistic writes to IndexedDB queue; replay when online; conflict resolution = last-write-wins plus server validation on status/paid amounts.
- Notifications: web push via VAPID (hosted in API) or Supabase functions; schedule daily check for due/overdue; client permission prompt gated.
- Analytics: server-aggregated views (Postgres materialized views) + client charts (e.g., Recharts).

### Core Flows
- **Add entry** → create transaction or schedule (plus occurrences) tied to selected date; if recurring, precompute future occurrences (rolling 90-365d).
- **Mark paid** → update occurrence status, paid_amount, paid_date; if debt-linked, reduce debt balance; log history.
- **Snooze** → shift a single occurrence date by N days; mark status = Scheduled.
- **Regenerate schedule** → for debt accounts, recompute occurrences when due day or recurrence changes (keep history intact).
- **Offline** → cache dashboard payload (occurrences for next 30d, debts, snapshots). Queue mutations (create entry, mark paid, snooze). Show offline badge + disable push requests until online.

### UI Notes
- PWA install prompt on dashboard when eligible.
- Loading strategy: skeleton for dashboard list + calendar dots; incremental hydration with streaming if using App Router.
- Accessibility: keyboard nav on calendar, buttons labeled for screen readers, color-safe status chips.

### Edge Cases
- Partial payments: allow paid_amount < planned_amount; status = Partial; balance reduced accordingly.
- Missed payments: auto-mark if past due and no paid_date; keep occurrence, do not delete.
- Recurring end rules: end_date vs occurrences count; support “no end”.
- Time zones: store dates as date (no time) in DB; client uses local TZ for display.
