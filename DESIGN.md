# DESIGN.md

## Design principles
- Calm, clean, premium: it's a wedding business, so warm and elegant rather than corporate.
- Phone-first, desktop-friendly.
- The most common actions (add booking, add payment) are one tap from anywhere.
- Money numbers are large and obvious.

## Visual direction (draft, change freely)
As built in the prototype (`src/styles.css`):
- **Palette:** page `#F1F4EE`, cards `#FFFDF9`, text `#17231D`, deep green `#16392B` (side menu, main buttons), marigold `#E3A21A` (keyboard focus and the active menu marker).
- **Status colors:** Confirmed green, Tentative amber, Enquiry grey-blue, Completed grey, Cancelled red; payment Paid green, Partial amber, Unpaid red. Each is a label as well as a colour.
- **Typography:** Bricolage Grotesque for headings, DM Sans for text. Both are free on Google Fonts.
- **Shape:** rounded cards (12px), soft shadows, generous spacing. Tables on desktop, stacked rows on phones.
- Light only for now.

## Chart colours
- Colour follows the thing it stands for on every chart: revenue green `#008300`, cancellation income blue `#2a78d6`, still to collect amber `#eda100`, expenses red `#e34948`, profit near-black.
- Expense categories: Labour blue, Decor orange, Catering aqua, Electricity yellow, Cleaning pink, Other violet.
- Years run light to dark green on revenue pages and light to dark red on expense pages, newest darkest.
- Checked with a colour-blind separation validator. Green and red are close for some people with red-green colour blindness, so those two are never the only clue: every chart has a legend, hover labels and a "Show table" view.

## Screens
1. **Login** — email + password (or Google sign-in).
2. **Dashboard** — KPI cards (Revenue this month, Pending, Events this month), monthly revenue chart, upcoming events list, recent payments.
3. **Calendar** — month view, booked dates highlighted by status; tap a date to see/create booking.
4. **Clients** — searchable list; tap for detail.
5. **Client detail** — contact info, bookings, documents, payment history, balance.
6. **Booking form** — client, date, type, guests, agreed amount, status, notes.
7. **Add payment** — amount, date, mode, note, optional receipt photo (bottom sheet on mobile).
8. **Documents** — grid/list per client with type tags, upload button, preview.
9. **Reports** — revenue by month/year, pending dues, CSV export.
10. **Search** — one search bar (name, phone, date, range); results list with date, client, price, balance; filters for year, type, status.
11. **Revenue & Profit** (owners) — summary cards (total price, collected, pending, expenses, profit); per-event table; monthly/yearly charts; year-vs-year comparison; export.
12. **Event detail** — client info, payments, expenses, invoices, staff and attendance, profit for this event. Has a **Cancel booking** button; on a cancelled event it becomes a grey "Cancelled" banner with a **Restore booking** button and an edit link for the kept amount.
13. **Staff** — staff list with role and daily wage; monthly attendance summary.
14. **Attendance (manager view, phone-first)** — today's/upcoming events; open an event, tick employees from the list, mark Present / Absent / Half day. No money shown anywhere.
15. **Import** (owners) — upload sheet, preview with errors, confirm; then attach invoices per event.
16. **Settings** — garden name, users and roles, backup/export, change password.

**Revenue Graphs page and Expense Graphs page** (owners only, two separate entries in the navigation under "Analytics"): filter bar at the top (year, season, event type, include cancellation income), a row of highlight cards (best season, best month, growth vs last year), then charts in a responsive grid (one column on phone, two on desktop). Revenue uses green; expenses use a warm red/orange; profit uses gold. Cancellation income gets its own colour in revenue charts. Tapping a bar or slice opens the list of events/entries behind it. Every chart has a plain-text table view and a download button.

**Cancel booking dialog:** shows "Advance received: ₹X" and three choices (Keep full advance / Keep part, refund rest / Refund everything), an amount field for the partial case, optional reason, and a clear summary line ("₹X will be added to revenue as Cancellation income"). Confirm button is only enabled once a choice is made. After cancelling, a toast with an **Undo** button appears for a few seconds.

Revenue page shows "Cancellation income" as its own card and chart colour.

Manager sees a reduced app: Calendar, Events (no money), Attendance, Staff.

## Navigation
- Mobile: bottom tab bar (Dashboard, Calendar, Clients, Reports) + floating "+" button (New booking / Add payment / Upload document).
- Desktop: left sidebar with the same items.

## Components
KPI card, status chip, data table / list card, calendar grid, bottom sheet / modal form, file uploader with preview, empty states, confirm-delete dialog, toast notifications.

## Design process
1. Rough wireframes (low-fidelity) for the 10 screens.
2. Clickable prototype with dummy data.
3. Owner reviews → feedback → lock design.
4. Only then build the real frontend, then backend.

## Design decisions log
| Date | Decision |
|------|----------|
| 2026-10-15 | Initial palette and screen list drafted |
| 2026-10-16 | Palette and fonts changed in the build (deep green and marigold, Bricolage Grotesque and DM Sans). Delete booking, booking types and invoices added to the screens |
