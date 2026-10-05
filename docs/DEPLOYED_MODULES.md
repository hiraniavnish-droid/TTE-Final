# Deployment module audit — 5 October 2026

Restored Git-tracked release modules omitted by the earlier selective API deployment:
- Attendance UI, API, desktop/mobile links and dashboard entry (previous restoration).
- Public Rann brochure and both timelapse videos at their original URLs (previous restoration).
- Availability UI/API and desktop/mobile navigation, existing Rann inventory and CRM holds.
- Rajarshi hub, five ready packages and hotel builder subroute.
- MAX admin settings and authenticated settings/worker handlers; handlers rebuilt from TypeScript on every deployment.
- Rich Rann quotation PDF and multiple-category PDF controls in standalone builder and lead costing panel.

Existing lead loading/session fixes, payment editing, website attribution and additive SOU API remain in place. No database migrations or data edits are performed by this restoration. Local Accounts migration draft remains unreleased. The legacy `api/v1/[...path].ts` is superseded by the existing `/api/v1/:path*` rewrite to the compiled handler; it is not an absent endpoint.

MAX's one-minute cron is absent in the current deployment. Its worker handler is restored, but the schedule is intentionally not activated as part of this module visibility fix: doing so could deliver queued outbound automation events. Existing saved MAX settings are retained.

Verification: production build; signed session and MAX validation tests; intercepted availability workflows and desktop/mobile screenshots; read-only production inventory/hold table checks. No real holds, inventory snapshots, staff attendance or customer messages are created by testing.
