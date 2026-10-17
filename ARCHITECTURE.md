# ARCHITECTURE.md

Goal: a real, reliable app for a family (a few owners plus a manager) at **~₹0/month**.

> Free-tier limits change. Verify each provider's current pricing page before committing.

## Cost options

### Database (records: clients, bookings, payments)
| Option | Free tier (approx.) | Pros | Cons |
|--------|--------------------|------|------|
| **Firebase Firestore (Spark plan)** | ~1 GiB storage, ~50k reads/day, ~20k writes/day | No server to manage; built-in Auth; plenty for one user | NoSQL, so reports need careful data design |
| **Supabase** | ~500 MB Postgres, built-in auth | Real SQL, easy revenue queries | Free projects pause after about a week of inactivity |
| **SQLite file + Google Drive backup** | Free | Simplest | Needs some server/hosting |

### File storage (client documents, receipts)
| Option | Free tier (approx.) | Pros | Cons |
|--------|--------------------|------|------|
| **Google Drive (owner's own account)** | 15 GB shared with the account | Already owned, familiar, files viewable outside the app | Needs Drive API integration |
| **Cloudflare R2** | ~10 GB, no egress fees | Generous, cheap beyond free | Needs card on file for signup |
| **Firebase Storage** | Newer projects may need the paid Blaze plan | Easy integration | Likely not ₹0, so check before relying on it |
| **Supabase Storage** | ~1 GB | Same dashboard as DB | Small |

### Hosting (the frontend)
Firebase Hosting, Cloudflare Pages, or Vercel/Netlify: all have free tiers that comfortably cover a one-user app.

## Recommended starting stack (pending owner approval)
- **Frontend:** React + Vite (+ Tailwind), installable as a PWA
- **Auth:** Firebase Auth (single owner account)
- **Database:** Firestore (Spark plan)
- **Documents:** Google Drive folder via Drive API, with the file link/ID stored in Firestore. Fallback: Cloudflare R2.
- **Hosting:** Firebase Hosting or Cloudflare Pages
- **Backups:** monthly JSON export button + copy to Drive

Why: free, no server to maintain, and the same Firebase approach is already familiar from other projects.

Alternative if SQL reporting matters more: Supabase (DB + Auth) + Google Drive for files.

## Data model (draft)
```
clients/{clientId}
  name, phone, altPhone, email, address, notes, createdAt

bookings/{bookingId}
  clientId, eventType, eventDate, startTime, endTime, guests,
  status, totalAmount (paise), notes, createdAt

payments/{paymentId}
  bookingId, clientId, amount (paise), date, mode, note, receiptDocId?

documents/{docId}
  bookingId, type ("Invoice" | "Agreement" | "ID proof" | "Receipt" | "Photo" | "Other"),
  number? (invoice number, unique), name, uploadedAt, size, mime, hasFile,
  driveFileId | storagePath   (prototype: the file sits in the browser under this document id)

expenses/{expenseId}   (optional)
  bookingId?, category, amount (paise), date, note

users/{uid}
  email, name, role ("owner" | "manager")

staff/{staffId}
  name, phone, role, dailyWage (paise), active

attendance/{attendanceId}
  bookingId, eventDate, staffId, status ("present" | "absent" | "half"),
  wageApplied (paise), markedBy, note

settings
  gardenName, eventTypes[] (booking types, owner-editable), seasons[{ name, months[] }]
```
Derived (not stored): total received, balance, labour cost per event (from attendance), profit per event, revenue by month.

Imported legacy events use the same `bookings` collection with `source: "imported"`.

## Cancellations
Cancelling is a status change, never a delete. The settlement lives in the owner-only money area:
```
cancellations/{bookingId}
  cancelledAt, reason, previousStatus,
  advanceReceived (paise), advanceKept (paise), refunded (paise),
  history: [{ at, by, action ("cancel" | "edit" | "restore"), oldKept, newKept }]
```
- Revenue = normal event revenue + `advanceKept` from cancellations (dated by `cancelledAt`).
- Restore: set status back to `previousStatus`, mark the cancellation as restored (kept for history, excluded from revenue). Cancelled and restored events are excluded from "pending balance".
- Keeping the settlement separate from the booking means the manager role never sees it.

## Prototype storage (temporary)
- Records live in `localStorage` (key `garden-manager-v1`). Invoice files live in IndexedDB (`garden-manager-files`), looked up by document id.
- Clearing browser data loses both. The backup JSON in Settings contains the records but **not the invoice files**.
- All file access goes through `src/lib/files.js` (put, get, delete, list). Phase 3 replaces that one file with Drive or cloud storage, and the reducer actions with database writes. The screens do not change.
- There is no login. The Owner/Manager switch is a preview. Real enforcement is the Firestore rules described under Security.

## Search
The prototype filters in the browser (`src/lib/search.js`). Firestore has no built-in full-text search. With a few thousand events over 6+ years, load a lightweight index (date, client name, phone, event id) into the browser and filter locally. This is instant and free. Date-range filters can use Firestore queries directly. Revisit only if data grows far beyond this.

## Analytics (revenue and expense graphs)
- Charts library: Recharts (free, works well with React).
- Seasons are configured in `settings/seasons` (name + list of months). A season is derived from the event date, never stored on the booking, so changing the season definition updates every graph retroactively.
- Aggregation (by month/season/year/category) is computed in the browser from the loaded bookings, payments and expenses. A few thousand records is fast and costs nothing. If data ever grows large, add precomputed monthly summary documents.
- Expense `category` should come from a fixed editable list so the category graphs stay clean (no free-text typos).
- Analytics pages are owner-only; the manager role has no access to them.

## Old data import
1. Owner supplies old records as Excel/CSV (we clean the columns once).
2. Import script/page validates rows, shows errors, then batch-writes bookings and payments.
3. Invoice scans/photos uploaded afterwards in batches and linked to events. Size estimate: 6 years of events with a few MB of scans each should fit within the free Drive space, but confirm once the real count is known.

## Security
- Invite-only accounts: only emails registered in `users` can log in. Role is stored per user.
- Firestore rules: owners can read/write everything; managers can read bookings **without money fields** (keep price/payment data in separate collections so rules can block them), read staff, and read/write attendance only.
- Documents private; no public links.
- No secrets in the repo; use environment variables.
- Regular export as backup.

## Decision log
| Date | Decision | Status |
|------|----------|--------|
| 2026-10-15 | Family-only app (owners + manager roles), design first | Agreed |
| 2026-10-15 | Money data kept in separate collections from event details so the manager role can be blocked from it | Proposed |
| 2026-10-15 | Stack: React + Firebase + Drive | Proposed, awaiting approval |
| 2026-10-16 | Prototype built on React + Vite + Recharts with browser storage | Done, temporary |
| 2026-10-16 | Booking types stored in settings, not in code | Done |
| 2026-10-16 | Delete booking removes attached money and files; Undo restores the whole app state | Done in prototype. In Phase 3 use a soft delete with a short recovery window |


## Backend contract (added Session 3)
A backend is an object: `name`, `load() -> {state, role}`, `write(ops)`, `subscribe(onOps) -> unsubscribe` (changes from other devices only), optional `setRole(role)`.
An op is `{op:'set'|'delete', collection, id, data}`. Collections: clients, bookings, payments, expenses, cancellations (keyed by bookingId), staff, attendance, documents, plus settings/main. Last write wins per record. Screens never talk to a backend; only store.jsx does.
