# CRM API support for the existing MAX bot

Base: `https://ttecrm.vercel.app/api/v1`. This release extends the CRM API and its durable event queue. It does not build a bot or send WhatsApp messages. MAX remains responsible for deciding, drafting and sending.

All calls require `x-api-key`. New quote/message/settings writes require `Idempotency-Key`; lead PATCH also accepts `If-Match` containing the lead's latest `updated_at`. Reuse the same key for the same retry; use a new key for a different operation. A changed body with a reused key returns 409. New writes commit their record, audit entry and retry response atomically. Limits are 120 requests/minute per client across reads and writes; 429 includes Retry-After. No delete endpoints are provided.

## Connect MAX

Admin: Team Settings → MAX sales automation. Enter your existing bot's public HTTPS webhook URL and a 32–256 character signing secret, then enable outbound events. The saved secret is never returned by the API or settings UI. Outbound delivery is enabled for the configured Cursor/MAX routine. Alternatively:

```sh
export BASE=https://ttecrm.vercel.app/api/v1
# Set CRM_API_KEY privately in your shell; do not put it in source control.
curl "$BASE/automation/settings" -H "x-api-key: $CRM_API_KEY"
curl -X PATCH "$BASE/automation/settings" \
  -H "x-api-key: $CRM_API_KEY" -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: configure-max-v1' \
  --data '{"enabled":true,"target_url":"https://YOUR-BOT/webhook","signing_secret":"YOUR-32-CHARACTER-OR-LONGER-SHARED-SECRET"}'
curl "$BASE/automation/deliveries?limit=20" -H "x-api-key: $CRM_API_KEY"
```

Settings/delivery endpoints require `automation:manage`. Normal bot operation needs `leads:read`, `leads:write`, `quotes:write`, `messages:write`, `availability:read`; existing PDF generation uses `quotes:generate`. The existing primary key has `*`. Restricted keys must include the new scopes explicitly.

## Signed outbound events

`lead.created` fires only for a newly created admin-owned/unassigned lead. `lead.assigned_to_admin` fires when ownership changes to admin/unassigned. Admin includes an existing CRM user with role admin, or the admin/Avnish alias. Team-owned leads are excluded, including at dispatch time.

```json
{"id":"event-uuid","event":"lead.created","occurred_at":"2026-10-01T10:00:00Z","data":{"id":"lead-uuid","ref_id":"TTE-0586","name":"Guest","phone":"...","source":"...","status":"New","owner":null,"trip":{},"created_at":"..."}}
```

Headers: `X-MAX-Event`, `X-MAX-Event-Id`, `X-MAX-Signature: t=<unix-seconds>,v1=<hex>`. Signature is HMAC-SHA256 with the shared secret over the exact string `<timestamp>.<raw request body>`. Verify the raw bytes before JSON parsing, compare safely, and reject timestamps more than five minutes old. The receiver should store event IDs and deduplicate them before taking any customer-facing action. Return 2xx only after accepting the event durably. Delivery is at least once: timeout, non-2xx, and network errors retry with exponential backoff, starting at 60 seconds, capped at six hours, up to ten attempts. A failed delivery remains recorded; no record is deleted. Redirects/private-network targets are rejected.

```js
import crypto from 'node:crypto';
function verify(rawBody, signature, secret) {
  const match = /^t=(\d+),v1=([a-f0-9]{64})$/.exec(signature || '');
  if (!match || Math.abs(Date.now()/1000 - Number(match[1])) > 300) return false;
  const expected = crypto.createHmac('sha256',secret)
    .update(match[1] + '.').update(rawBody).digest();
  return crypto.timingSafeEqual(expected,Buffer.from(match[2],'hex'));
}
```

## Follow-up schedule

Changing an eligible lead to Proposal Sent starts four CRM tasks. Logging a new quote resets the schedule from the quote's created_at (default now):

| Step | Due in IST |
| --- | --- |
| 1 | 3 hours after the anchor |
| 2 | Next calendar day, 10:30 AM |
| 3 | Anchor date +2 calendar days, 6 PM |
| 4 | Anchor date +4 calendar days, 11 AM |

Before 9 AM moves to that day's 9 AM; at/after 9 PM moves to next day's 9 AM. Retries of follow-up events also respect the window. A one-minute Vercel cron runs the authenticated CRM queue worker. Due times are targets, not second-level delivery guarantees.

A due step sends `followup.due` with `data: {lead_id, ref_id, step, due_at, last_note}`. CRM does not send a customer message. Remaining steps are cancelled on inbound customer message, Won/Lost, or transfer to a team member. Cancelled tasks are retained and marked completed. Incoming messages recorded by the existing CRM WhatsApp integration also update the customer timestamp. Existing historical proposals are not automatically backfilled into a new schedule.

## Trip and message timestamps

```sh
curl -X PATCH "$BASE/leads/TTE-0586" \
  -H "x-api-key: $CRM_API_KEY" -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: trip-update-unique-id' -H 'If-Match: LATEST_UPDATED_AT' \
  --data '{"trip":{"tent":"Premium Tent","check_in":"2026-11-15","nights":2,"rooms":1,"adults":2,"children_under_6":1,"occupancy":"double"},"last_customer_message_at":"2026-10-01T10:00:00Z","last_bot_message_at":"2026-10-01T10:01:00Z"}'
curl "$BASE/leads?owner=admin,unassigned&limit=20" -H "x-api-key: $CRM_API_KEY"
curl "$BASE/leads/TTE-0586/activity?limit=5" -H "x-api-key: $CRM_API_KEY"
```

Trip aliases also work at the top level. Occupancy is single/double; adults 1–1000, children_under_6 0–1000, rooms 1–1000, nights 1–365. Dates must be real YYYY-MM-DD dates; message timestamps must be ISO timestamps, not over five minutes in the future. A null timestamp cannot be used to erase history through PATCH. `activity` includes notes, quotes, WhatsApp messages and status changes, newest first, with cursor pagination. `updated_since` applies to the existing lead list; activity/needs_attention have their own cursors.

## Log a quote

```sh
curl -X POST "$BASE/leads/TTE-0586/quotes" \
  -H "x-api-key: $CRM_API_KEY" -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: quote-unique-id' \
  --data '{"category":"Premium Tent","check_in":"2026-11-15","nights":2,"rooms":1,"pax":{"adults":2,"children_under_6":0},"total":43896,"discount_percent":0,"pdf_url":"https://YOUR-PUBLIC-PDF.pdf"}'
```

Returns 201 `{data: <quote record>}` with id, lead_id, ref_id, dates, pax, numeric rupee total, discount, PDF URL and timestamps. New/Contacted become Proposal Sent; Discussion/Won/Lost are not moved backwards. Won/Lost or team-owned leads do not receive bot follow-up schedules. Generating a PDF alone does not log a quote: after `/rann/quote/pdf-link`, call this endpoint once. A new quote restarts pending steps; retrying its Idempotency-Key does not.

## Log WhatsApp messages

```sh
curl -X POST "$BASE/leads/TTE-0586/messages" \
  -H "x-api-key: $CRM_API_KEY" -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: whatsapp-provider-message-id' \
  --data '{"direction":"in","text":"We would like to confirm","time":"2026-10-01T10:00:00Z"}'
```

`in`/`inbound` and `out`/`outbound` are accepted. Time defaults to now. Messages appear in the existing lead WhatsApp history, update the appropriate last-message timestamp and are returned by activity. Inbound cancels remaining steps. This call records a message; it does not send it.

## Daily safety net

```sh
curl "$BASE/leads/needs_attention?limit=50" -H "x-api-key: $CRM_API_KEY"
```

Returns eligible Proposal Sent/Discussion leads with overdue follow-up, or no customer/bot/quote activity for at least 24 hours, sorted oldest attention_since first. Includes attention_since and overdue_followup plus normal lead fields. MAX can poll daily; the CRM does not launch a new bot.

## Availability

```sh
curl "$BASE/availability?check_in=2026-11-15&nights=2&category=163" -H "x-api-key: $CRM_API_KEY"
```

Returns `{data:{check_in,nights,category,package_id,supplier_available,crm_held,tents_left,checked_at,source:"saved_supplier_snapshot",live:false}}`. This reads the most recent manually saved supplier inventory and subtracts active/unexpired or confirmed CRM holds. It does not refresh the supplier on every bot call. Check `checked_at` before promising a customer stock. Nights 1/2/3 map to the existing CRM packages. Categories: 161 Non-AC Swiss Cottage; 162 Deluxe AC Swiss Cottage; 163 Premium Tent; 164 Super Premium Tent; 165 Rajwadi Suite; 166 Darbari Suite. IDs or exact names accepted. An unchecked date/category returns 404 `availability_not_checked`, never fabricated zero stock.

## Errors and rollout checks

401 invalid/missing API key; 403 missing scope; 400 invalid_request/invalid_category; 404 not_found/availability_not_checked; 409 idempotency_conflict/idempotency_in_progress; 412 version_conflict; 429 rate_limited; 503 database/worker unavailable. Validation failures do not create records.

Database migration: `022_max_sales_automation.sql`. New tables are server-only with RLS. Rollback transaction checks verify owner exclusions, all four IST times, quote/message replay, customer-reply/Won cancellation, activity, queue claim, preflight, retry and successful completion. Node tests verify validation, HMAC and dispatcher behavior. A real MAX receiver delivery test requires your webhook URL and matching signing secret.


## Cursor routine authentication

The CRM also sends the routine key as an `Authorization: Bearer ...` header. It is stored only in the Vercel Production secret `MAX_WEBHOOK_AUTHORIZATION`. `MAX_WEBHOOK_AUTH_TARGET_URL` pins this header to the configured receiver URL, so changing the webhook to another destination does not disclose the key. Both secrets require redeployment when changed. HMAC `X-MAX-Signature` remains enabled using the saved signing secret. Keys are intentionally excluded from this handoff.

Configured receiver: `https://api2.cursor.sh/automations/webhook/f5359d29-cb4b-55d0-85db-810f62bd9d79`. A labelled, non-customer lead.created test was accepted with HTTP 200. This proves HTTP acceptance, not that the routine has completed its downstream actions.


## Test from the deployed CRM

`POST /automation/test` requires `automation:manage` and `Idempotency-Key`. Body: `{ "event": "lead.created" }` (also accepts lead.assigned_to_admin or followup.due). Sends a labelled synthetic dry-run event through the same deployed sender, with no customer phone and no real lead. Returns `{data:{event_id,event,test:true,http_status,accepted}}`. Check accepted/http_status; HTTP 200 on this test API means the test result was recorded, not necessarily receiver acceptance. The receiver must treat test/dry_run events as tests. Calls are audit-logged and same-key retries replay the result.
