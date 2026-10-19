# SESSION_HANDOFF.md

Update this at the end of every working session. Newest session on top.

---

## Session 2 — 2026-10-16 to 2026-10-17

### Done
- Built the whole prototype in `garden-manager/` (see `CLAUDE.md` code map). It runs on 6 years of made-up demo data and saves in the browser.
- Screens: Dashboard, Calendar, Events and search, Event detail, Invoices, Money, Revenue graphs, Expense graphs, Staff, Attendance, Import old records, Settings. Manager sees only Attendance, Calendar, Events, Staff, with no money.
- Owner's new requests, all working: add and delete bookings (delete asks first and has Undo), add/rename/remove booking types, keep old invoices and add new ones, search by client name or date.
- Checks run: `npm run check` (money rules, search, delete, booking types, import helpers) passes. A browser test of every screen at desktop and phone width found no errors or sideways scrolling. A browser test of 22 actions passes: add booking, six kinds of search, invoices for an old and a new event, booking types, delete with Undo, import, manager limits.

### Decisions made
- Reading of "keep previous years' invoices": old events can be saved with only a client name and a date. Price and payments are optional. Invoices are attached to the event afterwards, one by one or in batches.
- Delete is allowed (owner asked), for owners only, with a confirmation and Undo. Cancel stays the way to handle a client who cancels.
- Booking types are editable. A type in use is removed by choosing where its bookings move.
- The manager does not see wages either (money). A staff member added by the manager has no wage until an owner sets it.
- Chart colours were checked with the palette validator for colour-blind separation (see `DESIGN.md`).

### Known limits of the prototype
- Everything is saved only in this browser. Clearing the browser data loses it.
- The backup file (Settings, Your data) holds the records but NOT the invoice files. Do not rely on it for invoices until Phase 3.
- No login yet. "Using the app as" is a preview switch, not security. The manager rules must be enforced in the database in Phase 3.
- Fonts load from Google Fonts. Offline, the app falls back to system fonts.

### Next steps
1. Owner tries the prototype, says what to change (screens, wording, anything missing).
2. Owner answers the open questions below, then we import the real old sheet through "Import old records".
3. Phase 3: pick the backend (Firebase proposed), move records and invoice files to it, add login and roles, make backups include files.

## Session 1 — 2026-10-15

### Done
- Agreed on the idea: management platform for the marriage garden.
- Created planning files: `CLAUDE.md`, `SESSION_HANDOFF.md`, `REQUIREMENTS.md`, `DESIGN.md`, `ARCHITECTURE.md`.
- Scope revised after owner's second message (see decisions).

### Decisions made
- App is for the **family owners only** (a few accounts), invite-only, no public sign-up.
- Design first, backend later.
- Cost target: negligible; free tiers only unless approved.
- Must support importing **6 years of old data and invoices**, and searching by client name or date.
- Needs a structured **revenue and profit page** (total price, expenses, profit per event/month/year).
- **Manager role + staff attendance** is approved as a feature: manager picks employees per event day and marks attendance, but cannot see money. Built after the core finance features.
- **Cancellations:** when a booking is cancelled after advance, the owner chooses to keep all, part, or none of it. Kept advance counts as "Cancellation income" in revenue. Cancel can be undone with "Restore booking", and the kept amount can be edited. Details in `REQUIREMENTS.md` section 2a.
- **Analytics:** two separate owner-only pages, Revenue Graphs and Expense Graphs, with season-wise comparison across years. Seasons are defined by the owner. Details in `REQUIREMENTS.md` sections 7a and 7b.

### Decisions still open
- [ ] Final storage for documents/invoices (Google Drive vs Cloudflare R2). See `ARCHITECTURE.md`.
- [ ] Final database (Firestore vs Supabase).
- [ ] Format of the old data and invoices (Excel? notebook? scans?), and how many events.
- [ ] Staff wage model (fixed daily wage vs varies).
- [ ] Hindi/English UI.
- [ ] One hall or several.
- [ ] How do you define your seasons (month ranges)?
- [ ] Do the old records include expenses, or only revenue?
- [ ] Do you always keep the full advance on cancellation, or sometimes refund part?

### Next steps
1. Owner answers "Questions for owner" in `REQUIREMENTS.md`, especially the old-data format.
2. Pick the stack and record it in the `ARCHITECTURE.md` decision log.
3. Build a clickable prototype with dummy data: dashboard, calendar, search, client/event detail, revenue and profit page, attendance screen (manager view).
4. Review designs with the owner, then start the backend.

### Notes for next session
- Read `CLAUDE.md` first.
- Do not start backend work before the design is approved.
- Manager must never see prices, payments, revenue, profit or documents.


## Session 3 — Step 1 of the backend: storage layer (done)
- Owner chose: used from several phones and computers; Firebase.
- Added lib/sync.js, lib/writeQueue.js, lib/backends/local.js and memory.js. store.jsx now loads through a backend and saves every change as small writes with retry. Top bar shows Saving / Saved / Not saved yet with Retry.
- Behaviour for the user is unchanged; old browser data still loads (same key and shape).
- Checks: `node scripts/check-calc.mjs` passes (30 new sync checks incl. two devices converging and retry after failed saves); crawl clean; 22/22 end-to-end flows pass.
- Demo-data buttons are hidden unless the backend is the browser one.
- Next: Step 2 Firebase adapter (owner must create a free Firebase project, steps to be given), Step 3 roles and security rules (split prices and phone numbers into owner-only collections), Step 4 invoice file storage (check current free tiers first), Step 5 deploy and backups including files.

## Session 3 — Step 2: Firebase adapter and sign-in (built, not yet run against real Firebase)
- Added lib/backends/firestore.js (one Firestore doc per record at /<collection>/<id>, /settings/main, role from /users/<uid>), lib/firebase.js, components/AuthGate.jsx, .env.example, FIREBASE_SETUP.md, scripts/fake-firestore.mjs and 12 adapter checks (all pass). Online mode switches on when VITE_FIREBASE_* are set; otherwise the local prototype runs unchanged.
- Offline first load is refused (error screen with Try again) instead of showing empty data. Firebase SDK is a separate chunk, absent from local mode.
- Interim rules: owners only. Manager cannot use the online app until Step 3. Role switch hidden when online.
- NOT verified: real Firebase (sandbox has no internet). Owner must follow FIREBASE_SETUP.md and report what happens.
- Next: Step 3 manager rules (split price/phone/payments into owner-only collections), Step 4 invoice files, Step 5 deploy.

## Session 3 — Step 3: manager privacy enforced by the database (built, tested on a fake Firestore)
- lib/split.js is the single list of private fields (booking total, client phone/address, staff dailyWage, attendance wageApplied/wageFor). The Firestore adapter stores them in clientPrivate, bookingPrivate, staffPrivate, attendancePrivate (owner-only) and rejoins them in memory, so screens are unchanged. Manager devices never request those or payments/expenses/cancellations/documents; money fields show 0/empty there.
- firestore.rules (new file in repo root) is what the owner pastes into the console. A check parses it and compares to split.js.
- Manager attendance marks have no pay; an owner device runs the `fixWages` reducer action (store.jsx effect, online mode only) which fills wageApplied/wageFor, and re-does it if the manager changes a status.
- Adapter now writes only the part of a record that changed; persistent local cache enabled (fast open, fewer reads); first snapshot from an empty local copy is not trusted; load times out after 15 s.
- Still not verified against real Firebase. Check count: all pass.
- Next: Step 4 invoice files (check free tiers first), Step 5 deploy + GitHub + backups.

## Session 3 — Step 4: invoice files online (built, tested on fake Firestore)
- Owner chose files inside Firestore (no card) over Firebase Storage. Verified on firebase.google.com/pricing (Oct 2026): Cloud Storage has no Spark-plan quota (Blaze/card needed); Firestore Spark = 1 GiB, 50K reads/day, 20K writes/day. Cloudflare R2 free tier (10 GB) was not chosen: needs a server to keep files private, card requirement unconfirmed.
- lib/files.js: setFileStore, prepareFile (photos shrunk to 1800 px JPEG, PDFs kept, limit 8 MB local / 3 MB online), fileLimitMB. backends/firestoreFiles.js: /files/<id> + /fileParts/<id>_<n>, saved atomically, orphan cleanup only for files >1 day old. firestore.rules now covers files and fileParts (owner re-pastes rules).
- Owner decision: GitHub repo will be PUBLIC.
- Known limits: PDFs over 3 MB rejected online; 1 GiB total budget; backup export of files not built yet (Step 5).
- Next: Step 5 — GitHub repo (public) + README with full steps + GitHub Pages workflow (Firebase values as repo variables), backup that includes files, final pass.

## Session 3 — Step 5: backup, GitHub, deploy (built)
- Backup is now one .zip (records.json + files/<docId>/<name>) built by lib/backup.js + lib/zip.js (store-only zip, no library); restore reads .zip or old .json and puts files back. Verified in two browsers (download, fresh profile, restore, file back) and with `unzip`.
- Added README (full steps: try locally, Firebase, GitHub Pages), LICENSE (MIT, owner's name), .github/workflows/deploy.yml (runs checks, builds with VITE_FIREBASE_* repository variables, deploys to Pages), docs/screenshots (demo data only), .gitignore blocks .env, *.zip, garden-backup*.
- Repo is PUBLIC by owner's choice. Scanned files for personal info: none besides the licence name.
- Owner still has to: create the Firebase project (FIREBASE_SETUP.md), create the GitHub repo, push, set Pages source and the four variables, add github.io to Firebase authorized domains. Real Firebase never tested by me; ask for exact errors.
- Ideas not built: soft-delete/trash for deleted bookings, backup reminder, PWA install icon.

## Session 3 — Installable app (PWA) and first real Firebase run
- Owner ran FIREBASE_SETUP on real Firebase: sign-in worked. First reload then failed ("records could not be loaded"): with a cached empty collection, onSnapshot never reported server confirmation. Fixed by includeMetadataChanges + ignoring no-change events (firestore.js, new check). Owner confirmed it works after the fix.
- Owner asked: (1) must every new person be added in the Firebase console? Currently yes (Authentication user + users/<uid> doc with role). (2) wants a tap-the-icon app, not "run commands in VS Code".
- Built PWA: public/manifest.webmanifest, icons (gate with a flower, made by Claude), sw.js (caches the app's own files only), meta tags in index.html, registration in main.jsx (production only). Verified in Chromium: manifest, icons, service worker controls the page, opens offline. NOT verified on a real iPhone/Android install.
- README section 4 explains Add to Home Screen. Native store apps explained as paid and not needed.
- Open question for owner: build an in-app "Team" page so owners add people (email, password, role) without the Firebase console? Needs Firebase sign-up turned ON (rules still give accounts without a role nothing), and rules letting owners write users docs. Not built until owner says yes.

## Session 3 — People page (in-app user management)
- Owner said yes to building it. New: lib/backends/people.js (add/list/setRole/removeAccess/resetPassword, guards: not self, never zero owners, password >= 6), pages/People.jsx (nav 'People and sign-in' under Set up, online mode only), firebase.js creates accounts through a second in-memory auth instance so the owner is not signed out. Rules: /users/{uid} read own or owner, write owner only. 16 new checks; page verified in a browser against a fake Firestore (add, duplicate email message, role change, remove, own row protected, no phone overflow).
- Owner must (a) turn Firebase 'Enable create (sign-up)' ON, (b) re-paste firestore.rules, then use People page. NOT verified on real Firebase.
- Limits: removing access does not delete the Firebase Auth account (client SDK cannot); an email that already has an account must be given a role via console; passwords are chosen by the owner and shown once.


## Session: expenses and balance sheet (2026-10-19)
- Live site works on GitHub Pages with real Firebase (bad GitHub variable values fixed: typo in name, quotes, and a trailing line break in the project ID, which showed as "client is offline").
- Added: Expenses page (/costs), expense categories in Settings, `addExpenses`/`updateExpense`/category actions, garden expenses in calc/analytics/graphs/Money/Dashboard, Balance sheet page (/balance-sheet) with Excel download (`lib/balance.js`, `lib/xlsx.js`).
- Tested: npm run check (new section), Playwright costs.mjs (11 steps), flows 22/22, crawl clean, xlsx recalculated in LibreOffice (92 formulas, 0 mismatches).
- No firestore.rules change needed (expenses already owner-only).
- Not verified on real Firebase: saving the new fields (vendor, paid, mode) and settings.expenseCategories; owner should add one expense and reload.
- Ideas not built: expense receipt photos, budgets per category, recurring templates that auto-create, PDF export of the balance sheet.

## Session: phone polish (2026-10-19)
- Checked every page at 390 and 360 px as owner and manager. Fixed: small tap targets (buttons, links, close X, chart buttons, file inputs), modal height uses 100dvh with a sticky button bar, Expenses table becomes cards on phones, Money page shows Date/Client/Revenue/Profit on phones, client-name placeholder, two-column layouts stack under 1000px.
- Tests after the changes: npm run check, flows 22/22, crawl clean, phone audit no issues. Not tried on a real phone.
- Loading screens: new components/Splash.jsx (leaf ring + dots) replaces the plain "Checking who you are / Opening your records / Loading your records" texts; index.html also shows a small spinner before the code loads.

## Session: Bin (2026-10-19)
- Deleting a booking now moves it to the Bin (new page /bin, owner only; 30 days, Put back / Delete for good / Empty). New owner-only collection `bin` (sync.js COLLECTIONS, split.js OWNER_ONLY, firestore.rules). Old data without `bin` is normalised on load. Backup and file clean-up count bin invoices.
- OWNER MUST re-paste firestore.rules in the Firebase console, or deleting will fail to save.
- Next in plan (user said "do 2, 3, 4 one by one"): WhatsApp reminders, printable receipt, receipt photos on expenses, category budgets, backup reminder; then looks (logo, dashboard top), then weak spots (real-Firebase checks).
