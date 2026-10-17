# CLAUDE.md — Garden Manager

Project context file. Read this first at the start of every session, then read `SESSION_HANDOFF.md`.

## What this is
A private management web app for a marriage garden (wedding venue), used by the **family owners** and the garden manager. It stores each client's details, documents/invoices, booking dates, costs and payments, tracks revenue and profit, and records which staff worked each event. It is a family tool, not a SaaS product: invite-only accounts, no public sign-up, no multi-tenancy. The garden has run for 6 years, so old data and invoices must be importable and searchable. Scope update (2026-10-16): the owner mainly wants earlier years' invoices kept and new ones added, bookings and booking types that can be added and removed, and old events found by typing a client name or a date. Old years therefore need only a name and a date (price and payments are optional).

## Goals
1. Keep every client's record in one place: details, event date, documents, payments.
2. See revenue at a glance: collected, pending, per month, per event.
3. Avoid double-booking dates (calendar view).
4. Import 6 years of old events/invoices and find any past event fast by client name or date.
5. Revenue and profit page: total price, expenses, profit per event, month and year.
6. Manager can assign staff to an event day and mark attendance; labour cost flows into profit.
7. Cancelled bookings: kept advance counts as revenue ("Cancellation income"); cancellations are easy to undo or edit.
8. Two separate owner-only analytics pages: Revenue Graphs (by month, season, year, event type) and Expense Graphs (by category, month, season), with owner-defined seasons.
9. Invoices: keep earlier years' invoices (PDF or photo) and add new ones, tied to an event found by typing the client name or date.
10. Add and remove bookings. Booking types (Wedding, Engagement, ...) are editable data, not code: add, rename, remove in Settings.
11. Search any event by client name, phone, date ("4 Nov 2023", 04/11/2023), month, year or invoice number.
12. **Running cost ~ zero.** Prefer free tiers. Any paid service needs the owner's explicit approval.

## Non-goals (for now)
- Public booking site, client logins, online payment gateway.
- Public sign-ups or SaaS. Only two roles: Owner (family) and Manager.
- Native App Store / Play Store app (paid, not needed). The app installs from the browser as a PWA (icon, full screen, works offline).

## Phases
| Phase | Focus | Status |
|-------|-------|--------|
| 0 | Planning docs (these md files) | Done |
| 1 | Design: clickable prototype with demo data | Built, waiting for owner feedback |
| 2 | Frontend build (real components, local data) | Built: all screens work on data saved in the browser |
| 3 | Backend: auth, database, file storage | Steps 1-5 built (storage layer; Firestore adapter + sign-in; manager privacy via split collections + firestore.rules; invoice files stored inside Firestore; all tested against a fake Firestore, not yet against real Firebase). Remaining: owner runs FIREBASE_SETUP.md, pushes to a public GitHub repo, and reports what happens on real Firebase |
| 4 | Import from the real old sheets, attach real invoices, backup that includes files | Import screen built; real data not loaded yet |
| 5 | Deploy + polish | Built: GitHub Pages workflow, README, zip backup with invoice files. Not yet deployed by the owner |

## Working rules
- Design before backend. Do not start Phase 3 until the owner approves Phase 1 designs.
- Keep the stack small and boring. No dependency without a reason.
- Money is stored as integers in the smallest unit (paise), never floats. Currency: INR.
- Dates stored as ISO strings; displayed in `DD MMM YYYY`.
- Client documents are sensitive (ID proofs, agreements): never public URLs, never committed to git.
- Never commit secrets or `.env` files.
- Role rule: the Manager never sees prices, payments, revenue, profit or client documents. Enforce in database rules, not only in the UI.
- Imported historical records are tagged "Imported" and never silently overwritten.
- Cancel is for a client who cancels: it keeps the record and the kept advance, and every cancel/restore/edit is logged.
- Delete is for entries made by mistake (the owner asked for it): it asks first, removes the booking with its payments, expenses, attendance and invoices, and offers Undo. Only owners can delete.
- Only Confirmed and Completed bookings count as revenue. Enquiry and Tentative never do.
- Booking types come from `settings.eventTypes`. Never hard-code a list of types. A type in use can only be removed by moving its bookings to another type.
- Run `npm run check` after any change to money, search or import code. It must print "All checks passed".
- A cancelled booking's full price and balance never count in pending dues; only the kept advance counts as revenue.
- Update `SESSION_HANDOFF.md` at the end of every session.

## File map
- `CLAUDE.md` — this file
- `SESSION_HANDOFF.md` — what was done, what's next, open questions
- `REQUIREMENTS.md` — features, data fields, user flows
- `DESIGN.md` — visual design, screens, components
- `ARCHITECTURE.md` — stack options, cost comparison, data model, decision log
- `README.md` — how to run the prototype
- `FIREBASE_SETUP.md` — click-by-click Firebase setup for the owner

## Code map (`src/`)
- `lib/calc.js` — the money rules: revenue, pending, labour, profit, cancellation income
- `lib/analytics.js` — filters and grouping for the revenue and expense graphs
- `lib/reducer.js` — every change to the data (add/delete booking, cancel/restore, attendance, booking types, import)
- `lib/search.js` — understands "Sharma", "4 Nov 2023", "Nov 2023", "2022", phone digits, invoice numbers
- `lib/files.js` — invoice files: photos are shrunk, size limit, pluggable store (browser IndexedDB now; `backends/firestoreFiles.js` online, 600 KB pieces inside Firestore, 3 MB limit, owner-only)
- `lib/backup.js`, `lib/zip.js` — zip backup (records.json + invoice files) and restore
- `public/` — manifest, icons and `sw.js` that make the app installable on phones
- `lib/dates.js`, `format.js`, `csv.js`, `constants.js` — helpers (money is paise, dates are ISO strings)
- `data/seed.js` — made-up demo data (6 years). Settings, "Your data" can clear it
- `lib/sync.js` — turns each change into small writes (diffState), applies them (applyOps), merges them (coalesce)
- `lib/writeQueue.js` — saves writes in order, retries with waiting if the connection drops, reports saved/saving/error
- `lib/backends/` — where data lives: `local.js` (this browser, current), `memory.js` (fake server for checks). `firestore.js` is the real online one (SDK functions are passed in so checks can use `scripts/fake-firestore.mjs`). Contract: load, write, subscribe, optional setRole
- `lib/split.js` — the list of fields the manager must never receive; `firestore.rules` — the database rules built from it (paste into the Firebase console)
- `lib/firebase.js` — real Firebase wiring; `components/AuthGate.jsx` — sign-in screen and role check. Online mode turns on only when `.env.local` has the Firebase values (see FIREBASE_SETUP.md); otherwise the browser-only prototype runs
- `store.jsx` — app state; loads from the backend, sends every change through the write queue; `act()` runs a change and shows an Undo toast
- `pages/` — Dashboard, Calendar, Events (search), EventDetail, Invoices, Money, RevenueGraphs, ExpenseGraphs, Staff, Attendance, Import, Settings
- `components/` — forms, dialogs, charts, attendance panel
- `scripts/check-calc.mjs` — checks of the money rules, search, delete, booking types and import helpers

## How to run
`npm install`, then `npm run dev` (opens at http://localhost:5173). `npm run build` makes the `dist/` folder, which works on any static host. `npm run check` runs the checks.
The prototype has no login. "Using the app as" at the top switches between Owner and Manager to preview both views.

## Stack (tentative, see ARCHITECTURE.md)
Prototype: React + Vite + Recharts, data in the browser (localStorage, IndexedDB). Planned backend: Firebase Auth + Firestore, documents in Google Drive, hosted free. Final decision pending owner approval.
