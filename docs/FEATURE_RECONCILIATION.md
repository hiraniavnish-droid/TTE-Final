# CRM feature reconciliation — 5 October 2026

Compared the original local project with the current Git production source across routes, API handlers, contexts, pages, components, hooks, utilities, types and public media.

Restored missing workspace features:
- Search by name, phone and lead code; employee, creation month/custom range, stage, payment, destination and temperature filters.
- Active filter chips, individual removal, reset and named saved views per user/browser.
- URL-based filter/view/sort/group state, session filter/scroll restoration.
- Slide-out full lead details with Previous/Next, Escape, focus handling and unsaved-change warning.
- Website source and submitted enquiry fields in lead details.
- Dashboard month/custom date filters with IST boundaries, comparable month-to-date ranges and clearer KPI labels.
- Full background activity-history pagination, replacing the 200-row cap; corrected gauge label orientation.
- Rajarshi hotel-builder navigation/width and provider failure diagnostics for existing summary delivery.

Retained production improvements rather than overwriting with older local versions: 100-row independent lead fetching, bounded card rendering, loading/retry/export safeguards, robust partial trip normalization, session expiry/network timeout recovery, functional error boundary, editable manual payments, domain source badges and routing, separate new leads for repeat submissions, SOU API additions, restored attendance/availability/media/MAX controls and the approved MAX cron.

Mobile workspace scrolls vertically when the expanded filters exceed the viewport; its card lists retain bounded heights and incremental rendering.

Remaining difference requiring explicit authorization: local WhatsApp webhook forwards raw inbound customer messages to a Hermes endpoint. That forwarding is not activated by this reconciliation. Other API differences are intentional additive/restoration fixes. Legacy api/v1 catchall is served by the current rewrite, not duplicated.

Checks: production build, IST calendar tests, 2,407-lead loading/rendering/retry/session tests, combined-filter/saved-view/panel/mobile browser tests. Browser data is intercepted; no customer edits or messages are made by tests.
