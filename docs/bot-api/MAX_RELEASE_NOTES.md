# MAX API extension — release 1 October 2026

Production: https://ttecrm.vercel.app/api/v1
Deployment: dpl_H9prMTR3f2wsJVsPb1DEQLiAxoCJ

This is CRM API/infrastructure support for your existing bot. It does not create, replace or run an AI bot, and does not send WhatsApp messages.

Implemented:
- Signed outbound lead.created, lead.assigned_to_admin and followup.due events, durable queue, retries, ownership checks and cancellation.
- Configurable admin settings and masked API settings, plus delivery history.
- Four IST follow-up tasks and a one-minute authenticated Vercel worker.
- Trip/message timestamp PATCH support and combined admin/unassigned lead filter.
- Recent activity, atomic idempotent quote/message logging, and daily needs_attention read endpoint.
- Saved supplier availability minus active CRM holds; freshness timestamp returned.
- Server-only database tables, write audits, 120-request/minute shared limit, updated OpenAPI and curl examples.

Verified:
- Production build succeeded; deployment READY and aliased to ttecrm.vercel.app.
- Migration 022 applied successfully with row security enabled.
- Database rollback tests: owner exclusions, four exact IST times, quiet hours, quote/message replay, reply/Won cancellation, activity, worker claim/preflight/retry/completion. Test rows were rolled back.
- Node tests: input validation, expanded trip fields, private-network rejection, HMAC, dispatch success/failure and cancelled-event suppression.
- Live endpoints: missing key 401, masked settings 200, combined owner list 200, activity/needs_attention 200, invalid quote/message 400, malformed availability 400, unsaved availability 404, saved availability 200 with matching supplier count and hold subtraction.
- Worker and admin settings endpoints reject unauthenticated requests. Admin settings loads and saves in the CRM.
- Vercel logs confirm the scheduled worker returns 200 at roughly one-minute intervals.

Outbound delivery is now enabled for the provided Cursor/MAX routine URL. Its key is used for the Authorization Bearer header and HMAC signing. A labelled lead.created test sent from the deployed CRM was accepted with HTTP 200; a same-key retry replayed the recorded result without another send. No real lead or customer phone was attached to the test. This confirms receiver acceptance, not completion of downstream bot actions. Existing historical proposals are not bulk-enrolled. CRM does not send customer messages.

For MAX: start with MAX_AUTOMATION.md. Reuse the current CRM x-api-key. PDF generation remains a separate operation; log the quote after generating/sending it. Verify HMAC on raw request bytes and deduplicate event IDs before any WhatsApp action.

The release was deployed from an isolated copy of the last production source. Unrelated local drafts and Accounts migration 020 were not included or applied.

Receiver connection test event: 4bc67c83-bb8a-497c-a25e-fe12e6efbe4e. Bearer authentication is pinned to the configured URL using server-only Vercel secrets; keys are not included in the documentation. `POST /automation/test` is available for future connection checks.
