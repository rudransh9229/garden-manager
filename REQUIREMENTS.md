# REQUIREMENTS.md

## Users and roles
Private app for the garden's family owners, plus the manager. No public sign-up: only invited email accounts can log in.

| Role | Who | Can do |
|------|-----|--------|
| **Owner** | Family members (2–4 accounts) | Everything: clients, bookings, payments, revenue/profit, documents, staff, import, settings |
| **Manager** | Garden manager | See upcoming events (date, client name, event type, guests), add staff to an event day, mark attendance. **Cannot see** prices, payments, revenue, profit or client documents |

Why the manager is restricted: they need to run the day, not see the family's finances. This is enforced in the database rules, not just hidden in the UI.

## Core modules

### 1. Clients
- Name, phone, alternate phone, email (optional), address, notes
- Linked to one or more bookings

### 2. Bookings (events)
- Client, event type (wedding, engagement, reception, birthday, other)
- Event date (+ optional start/end time), number of guests
- Status: Enquiry → Tentative → Confirmed → Completed → Cancelled
- **Total price** agreed, notes
- Calendar view; warn if the date is already booked

### 2a. Cancellations and forfeited advance
- **Cancel** button on any booking. A dialog shows the advance already received and asks what happens to it:
  - **Keep full advance** (counts as revenue)
  - **Keep part, refund the rest** (owner types the amount kept; the refund is recorded)
  - **Refund everything** (nothing counts as revenue)
- Optional reason and cancellation date (defaults to today)
- Kept advance is shown on the revenue page as **Cancellation income**, separate from normal event revenue, so you can always see how much came from cancelled bookings
- The cancelled event's full price and pending balance **stop counting** (no fake pending dues); only the kept amount counts
- The event date is freed on the calendar
- Cancelled bookings are never deleted. They stay searchable, shown as "Cancelled"
- **Undo anytime:** "Restore booking" returns it to its previous status and removes the cancellation income. Owners can also edit the kept/refunded amounts later if the settlement changes
- Every cancel, restore and edit is logged (who, when, old and new amount)
- Owners only; the manager just sees the event as cancelled and disappearing from upcoming events

### 3. Old data import (6 years of history)
- Bulk import from an Excel/CSV sheet: date, client name, phone, event type, total price, amount received, notes
- Import preview with error report (bad dates, missing names) before saving
- Imported events are marked `Completed` and tagged "Imported" so they're easy to tell apart
- Invoices/scans attached afterwards, in batches (by event), not all at once
- Original sheet kept as a backup file

### 4. Search
- One big search box. Type it the way you would say it: a client name (part of a name is fine), phone digits, a date (`4 Nov 2023`, `04/11/2023`, `2023-11-04`), a day in any year (`4 Nov`), a month (`Nov 2023`), a year (`2022`), or an invoice number
- Filters for year, booking type and status. Newest events first. The screen says what it understood ("events in Nov 2023")
- Results show date, client, total price, balance; tap to open the full event with invoices
- Works across all 6+ years of data

### 5. Documents and invoices
- Upload per client / booking: agreement, ID proof, invoice, receipts, photos
- Type tag + upload date; preview/download; delete with confirmation
- Private only, never public links
- Owners only

### 6. Payments (owners only)
- Per booking: amount, date, mode (cash / UPI / bank / cheque), note, receipt attachment
- Auto-calculated: total received, balance pending
- Status chip: Unpaid / Partial / Paid

### 7. Revenue and profit page (owners only)
- **Per event:** total price, received, pending, expenses, **profit** = total price − expenses
- **Expenses per event:** labour (auto from attendance), decor, catering, electricity, cleaning, other
- **Per month / per year / all time:** total price, collected, pending, expenses, profit, number of events
- Year-vs-year comparison across the 6 years, best/worst months
- **Cancellation income** shown as its own line (kept advances), included in total revenue and profit, counted in the month the booking was cancelled. Can be filtered out to see "normal events only"
- Table view (sortable, filterable) plus charts; export to Excel/CSV

### 7a. Revenue graphs page (owners only)
A separate page, focused on understanding how revenue behaves over time and by season.
- **Season definition:** seasons are set by the owner in Settings (month ranges, e.g. Peak / Off / Monsoon). Defaults are provided and editable
- **Filters:** year (or all years), season, event type, include/exclude cancellation income
- **Graphs:**
  - Monthly revenue (bars), with a line for number of events
  - **Season comparison:** revenue per season for each year, side by side
  - Year-over-year: same months across the 6 years as separate lines
  - Revenue by event type (wedding, engagement, reception, etc.)
  - Average price per event, per season and per year
  - Collected vs pending, per month
  - Cancellation income per season
- **Highlights:** best season, best month, busiest month, growth vs last year
- Tap any bar to see the list of events behind it

### 7b. Expense graphs page (owners only)
A separate page for where the money goes.
- **Same filters** as the revenue page
- **Graphs:**
  - Monthly expenses (bars)
  - Expenses by category (donut + table: labour, decor, catering, electricity, cleaning, other)
  - Category trend over months (stacked bars)
  - **Season comparison:** expenses per season for each year
  - Labour cost trend (from attendance)
  - Revenue vs expenses vs profit, per month and per season (profit margin line)
  - Average expense per event
- **Highlights:** biggest expense category, most expensive month, expense growth vs last year
- Tap any bar to see the underlying expense entries

### 8. Staff and attendance
- **Staff list** (owner or manager): name, phone, role (waiter, cook, cleaner, decorator, security…), daily wage
- **Per event day:** manager opens the event, picks employees from the staff list, marks Present / Absent / Half day, optional note
- **Labour cost:** owners can see wage × attendance per event, which feeds into that event's expenses and profit
- **Monthly view:** attendance summary per employee (days worked, total wage due)
- Manager can edit attendance only for recent days (e.g. 7 days); owners can edit any time

### 9. Dashboard (owners)
- Revenue this month / year, pending balance, upcoming events (30 days), monthly chart, recent payments

### 10. Utilities
- Export to CSV/Excel
- Backup: download all data as JSON

### 11. Add and delete bookings (owners only)
- **New booking** from the Dashboard, Calendar (pre-filled with the chosen day) or Events: client name, mobile, town, date, booking type, agreed price, guests, status, notes, optional advance received
- A repeat client (same name and phone) is linked to the existing client
- **Delete** on the event page is for entries made by mistake. It asks first, removes the booking with its payments, expenses, attendance and invoices, and shows **Undo** for several seconds. If the client cancelled, use Cancel booking instead (section 2a)

### 12. Booking types (owners only)
- Settings lists the types (starting: Wedding, Engagement, Reception, Birthday, Other). Add, rename and remove them
- Renaming updates every booking of that type
- A type that bookings use can be removed only by choosing another type to move them to. At least one type always stays

### 13. Invoices, old and new (owners only)
- Invoices page: every invoice by year, searchable, with a way to add one
- Add an invoice to any event, old or new: find the event by typing the client name or date, give the date, a number (filled in as INV-YYYY-001, editable; a repeated number is refused), and attach a PDF or photo
- Open, attach a missing file, or delete an invoice from the event page
- Other document types (agreement, ID proof, receipt, photo) use the same form
- An event can be saved without any file, and the file attached later

## Non-functional
- Mobile-friendly: the manager will mostly use a phone for attendance
- Few taps to add a payment or mark attendance
- Cost ~ zero
- Data safety: regular export, private storage, role-based access

## Build order
1. **MVP:** clients, bookings, calendar, search, payments
2. Old data import (needed early so the real data is in from the start)
3. Revenue and profit page, expenses
4. Documents/invoices upload
5. Staff and attendance, manager role
6. Backup/export, polish

## Questions for owner
1. One garden only, or multiple halls/lawns/rooms?
2. Is your old data in an Excel sheet, a notebook, or scattered? In what form are the invoices (paper scans, photos, PDFs)? Roughly how many events in 6 years?
3. English only, or Hindi too (especially for the manager's screens)?
4. Payment modes to track?
5. Expense categories you actually track today?
6. Are staff paid a fixed daily wage, or does it vary per event or per person?
7. Do you need GST invoices generated by the app, or just records?
8. How many family accounts, and is there one manager or more?
9. When a booking is cancelled, do you always keep the full advance, or sometimes refund part of it?
10. Did past cancellations (in the old data) keep the advance? We can import them as cancelled with the kept amount.
11. How do you define your seasons? (For example Peak Oct–Feb, Off Mar–Jun, Monsoon Jul–Sep.) We'll make it editable.
12. Did you record expenses in the old data? If not, expense graphs will only be meaningful from the day you start entering them, and older years will show revenue only.
13. For earlier years, do you want only names, dates and invoices, or also the prices and payments? (The import accepts either.)
14. How are the old invoices kept: paper, phone photos, PDFs? Roughly how many?
