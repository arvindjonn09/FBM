## Local-Only PWA Plan (IndexedDB)

### Why this path
- Fastest cross-platform delivery; no backend or auth needed; data stays on device.
- Uses PWA install + service worker; IndexedDB via Dexie for persistence and recurrence generation.

### Architecture
- UI: Next.js (or Vite/React) + Tailwind; App Router optional.
- Storage: IndexedDB with Dexie schema: DebtAccount, Schedule, Occurrence, Settings, Backups.
- Offline-first: all reads from Dexie; service worker caches static assets + app shell.
- Notifications: limited on iOS Safari; use local “reminder” banner in-app; optionally Web Push on Android/desktop.
- Backup: export/import JSON (optionally encrypted with passphrase).

### Data model (Dexie schema)
```ts
// tables.ts
{
  debtAccounts: '++id, name, balance, apr, minPayment, dueDay, active',
  schedules: '++id, name, type, category, amount, startDate, frequency, interval, endDate, linkedDebtAccountId',
  occurrences: '++id, scheduleId, date, plannedAmount, status, paidAmount, paidDate',
  settings: 'id, key',
  backups: '++id, createdAt'
}
```
- `frequency`: 'none' | 'weekly' | 'fortnightly' | 'monthly' | 'yearly'; `interval` default 1.
- `status`: 'scheduled' | 'paid' | 'partial' | 'skipped' | 'missed'.

### Recurrence engine (offline-safe)
- On create/edit schedule: generate occurrences for next 12 months (or 180 days) from `startDate`; respect `endDate` or occurrence count.
- On app load: ensure coverage today → +12 months; if missing, generate forward; never delete past occurrences.
- Snooze: shift a single occurrence date by N days; maintain schedule untouched.
- Mark paid: set status, paidAmount, paidDate; if linked to debt account, reduce balance.
- Missed: if past due and status still scheduled, mark missed on app load.

### Screens & flows
- **Home**: upcoming 15 days list (actions: Mark Paid, Edit, Snooze), month calendar with markers, quick summary (next 15d debits vs credits, remaining debt balances, pay-first suggestion).
- **Add/Edit entry modal**: name, type (Debt/Credit), amount, category, recurrence, start date (selected), optional end date/#occurrences, notes. Debt extras: balance, APR, min payment, due day.
- **Debt Accounts**: list + detail; regenerate schedule button; show payment history.
- **Analytics (local)**: monthly credits vs debits vs debt payments; rolling 30d cashflow; category breakdown; avalanche/snowball ordering using balance/APR/min payment.
- **Backup**: export JSON; import JSON; optional passphrase encrypt/decrypt.
- **App lock** (optional): PIN stored hashed in Dexie; gate app on launch.

### Starter project outline
- `/app` or `/src` (Next.js) with routes: `/` (dashboard), `/debts`, `/analytics`, `/settings`.
- `/lib/db.ts` Dexie instance + schema.
- `/lib/recurrence.ts` to generate occurrences; pure functions.
- `/lib/payoff.ts` for avalanche/snowball sorting + projections.
- `/components` for calendar, lists, status chips, modals.
- `/workers/service-worker.js` (Workbox) for caching; add `manifest.webmanifest`.
- `/utils/backup.ts` for export/import (stringify Dexie tables; optional crypto).

### Open caveats
- Push notifications unreliable on iOS Safari; in-app reminders + email not available offline. For real notifications, move to native (Flutter/React Native) with SQLite.
- Data loss if phone wiped; emphasize export to Files/iCloud/Drive.
