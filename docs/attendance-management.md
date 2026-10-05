# Attendance and leave management — V1

Entry: `https://ttecrm.vercel.app/#/attendance`. The dashboard, desktop sidebar and mobile header link to the module. It uses existing CRM users and passcodes. Employees see their own records; current database administrators see the team and controls.

## Operations

- Employees explicitly check in/out. Server timestamps in Asia/Kolkata are authoritative. One record per person per day; duplicate punches are idempotent. No geolocation is requested or stored.
- Staff can request full/half-day leave, outdoor duty/work travel, or corrections for forgotten punches. Pending leave reserves the balance. Only Admin approves/rejects; employees can cancel pending requests, and Admin can cancel approved leave/outdoor duty. Correcting an approved correction uses the admin attendance editor.
- Leave is tracked by calendar year. Working days exclude weekly offs and configured holidays; the request preserves its calculated dates. A request crossing New Year must be split. Half days use 0.5 day. Paid leave cannot exceed approved plus pending balance. Unpaid leave has no paid quota.
- Admin can edit clock times, set presence/absence/half-day/outdoor/late-excused overrides, adjust yearly allowances (including opening/carry-forward balances), and configure working hours, working days, holidays, hour thresholds and lateness rules. Every change requires a reason and is audited.
- Starting policy follows the existing office settings: 10:00–19:00 IST, Monday–Friday. Existing leave type quotas are Casual 12, Sick 12, Earned 15. Full/half-day elapsed-hour review thresholds start at 8/4. These are configurable company settings, not statutory entitlements.
- Up to 30 minutes late on three days per calendar month is allowed. Further lateness is flagged for Admin. The next month resets the allowance. Corrections recalculate the order. Approved morning leave moves the arrival baseline to the shift midpoint. Each recorded day retains its policy, so a subsequent shift change does not reclassify past punches.
- Missing days before launch are labelled Not tracked. The module does not invent historical attendance, auto-deduct salary or consume leave for absences. A previous open day requires a correction before a new check-in.
- Monthly CSV reports contain statuses, punches, hours, lateness and notes. The admin audit view shows the latest 100 events; the database retains the complete audit.

## Architecture and permissions

`api/attendance.ts` verifies HS256 signature and expiry. The `crm_attendance_command` database transaction checks the current user and session version for every operation. Role is read from the database, not trusted from submitted form data. Direct anon/authenticated table and RPC access is revoked. Only the service role can execute the transaction.

Five dedicated tables: `crm_attendance_policy`, `crm_attendance_days`, `crm_attendance_requests`, `crm_attendance_entitlements`, `crm_attendance_audit`. The legacy `attendance`, `leaves` and `leave_balances` tables use unrelated `profiles` UUIDs and are retained without modification. No CRM lead/payment tables are changed.

Mutations serialize through a transaction-level advisory lock. Balance checks, status transitions, correction writes and audit entries commit together. Failed mutations roll back. An approved correction cannot overwrite a day updated after the correction was requested. Existing full-day leave conflicts must be resolved before punching or manually overriding attendance.

The page fetches on open, focus, manual refresh and every minute while visible. Filters remain local. The clock display uses a server offset; the backend independently timestamps each punch.

## Validation and deployment

- `node scripts/verify-attendance.mjs`: model/session tests and browser workflows with intercepted data. Requires local Vite at port 3020; Playwright uses the workspace's V2 installation. No real attendance is written.
- `node scripts/verify-attendance-db.mjs`: executes the migration and database integration tests inside a rolled-back transaction before first installation. Existing user IDs are used for scope tests; every test mutation is rolled back. After installation, use an isolated schema/database for replaying this creation migration.
- `node scripts/verify-attendance-concurrency.mjs`: creates a disposable isolated schema, verifies simultaneous check-ins, competing balance reservations and conflicting review decisions, then removes that schema.
- Production Vite build; existing unrelated repository-wide TypeScript issues remain in older quoting components and Deno edge functions. New attendance source is checked separately.
- Apply `supabase/migrations/012_crm_attendance.sql` once, then deploy V1 directly to its existing Vercel project. No Git push is required.
- Rollback of the UI/API is a Vercel deployment rollback. Retain the new tables so legitimate attendance is preserved. Removing a navigation entry is not a database rollback.

## Release record — 11 September 2026

- Migration installed successfully. Legacy attendance data retained.
- Live deployment: `dpl_EhKZUzSYkqutjMbsHi6izQfMdA1A`, aliased to `ttecrm.vercel.app`.
- Previous production: `dpl_J2zSAuLWviH8zyDUezaQXUiPuDDa` (`ttecrm-n3tuzvndv-avnishs-projects-f86e4864.vercel.app`).
- Source backup: `backups/pre-attendance-2026-09-11.tar` (excluded from deployment).
- Live unauthenticated request returned 401; authenticated admin snapshot returned 200 with the six existing CRM accounts. Live desktop/team/settings/mobile screens loaded without browser errors. Production verification performed no attendance mutations. Synthetic workflows ran only against intercepted browser data, rolled-back transactions or the disposable test schema.
