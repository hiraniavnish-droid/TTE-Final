# Hutoxy Pilot - CRM developer handover

## Identity and deployment

- Exact CRM employee / owner name: **Hutoxy Pilot**.
- Exact CRM owner ID: **`3`** (numeric value, represented as a string in JSON).
- This is the Hutoxy/Hutoxi pilot mentioned in the integration request.
- Dedicated base URL: **https://ttecrm.vercel.app/api/hutoxy/v1**.
- Authentication: **`x-api-key: $HUTOXY_CRM_API_KEY`** on every request.
- This key is for this dedicated base URL. It does not grant access to the main
  `/api/v1` API, MAX settings, other agents' leads, payments, or supplier costs.
- Initial mode: API access is test-number-only; outbound webhook delivery is
  **paused**, with no receiver URL configured. No existing leads were assigned
  to Hutoxy and no source auto-assignment rule was changed.
- Test phone: **+91 9601070220**. The business Interakt number **+91 9274730220**
  is not the test customer number and is not configured by this release.

The pilot queue/settings/idempotency tables are service-role-only, with RLS
enabled and no browser/public grants or policies. The security advisor reports
the lack of public policies as informational; it is intentional isolation.

The restricted API and event preflight enforce the owner, a Rann destination,
and the test phone in the database. Owner name and ID representations resolve
to the same employee. Unrecognised or ambiguous owners fail closed. Moving a
lead to another owner, another destination, or closing it cancels pending events.
The pilot key cannot lift the test-phone restriction or change the owner. An
administrator must approve and perform the later production-mode cutover.

## Credentials: secure handoff only

The API key and independent webhook signing secret are stored as sensitive
**Production** variables on Vercel's existing `ttecrm` project. Copies are in
Avnish's macOS Keychain under account `hiraniavnish-droid`:

- Service `ttecrm/hutoxy-pilot/api-key` -> bot host secret `HUTOXY_CRM_API_KEY`.
- Service `ttecrm/hutoxy-pilot/webhook-secret` -> bot host secret
  `HUTOXY_WEBHOOK_SIGNING_SECRET`.
- Service `ttecrm/hutoxy-pilot/employee-passcode` is an owner-controlled CRM UI
  credential, not the bot API key; it is not needed by the bot runtime.

Avnish can use Keychain Access to transfer the first two values into the bot
host's approved secret store. No value belongs in chat, this document, GitHub,
a URL query parameter, or frontend code. This release does not issue or change
Interakt credentials, and does not provision the external bot host.

## Available endpoints

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/health` | Owner identity, test-only status, webhook state and polling interval |
| GET | `/leads?updated_since=ISO&limit=50&cursor=...` | Only eligible Hutoxy leads, oldest updated first |
| GET | `/leads/{ref}` | Eligible lead details, without vendor costs or payment records |
| GET | `/leads/{ref}/messages?limit=50&cursor=...` | Recorded inbound/outbound WhatsApp messages, oldest first |
| POST | `/leads/{ref}/messages` | Log an already-sent outbound message; does **not** send it |
| POST | `/leads/{ref}/quotes` | Log a quotation against an eligible lead; does **not** reserve tents |
| GET | `/availability?check_in=YYYY-MM-DD&nights=1&category=Premium%20Tent` | Saved Tent City inventory, net of CRM holds |
| GET | `/itinerary/catalog` | Supported Tent City categories, dates and durations |
| POST | `/rann/quote` | Compute Tent City quotation |
| POST | `/rann/quote/pdf` | Generate the existing CRM quotation PDF with photos and itinerary |
| POST | `/rann/quote/pdf-link` | Generate a public media-download link for a quotation |
| GET/PATCH | `/automation/settings` | Inspect or configure this pilot's receiver and enable/pause delivery |
| GET | `/automation/deliveries` | This pilot's recent event states and HTTP results |
| POST | `/automation/test` | Send a signed, non-customer test event to Hutoxy's configured receiver |

`{ref}` may be a lead UUID or its `TTE-...` code. JSON successes use `data` except
PDF-link generation, which returns `url`, `filename`, and `expires_at` at the
top level. Responses include `request_id`. Errors are
`{"error":{"code":"...","message":"..."},"request_id":"..."}`.
No key is a 401; an inaccessible lead is a 404 `lead_not_in_pilot`. API rate limit:
120 requests/minute for this client. Requests must be JSON objects <=32 KB.

### Polling option

**120-second polling is supported** as an alternative to enabling webhooks.
List Hutoxy leads, follow every opaque `next_cursor`, and read their messages.
Keep the last successful `updated_since` watermark with a short overlap, and
deduplicate leads/messages by ID plus timestamp. Message pagination is scoped
to a specific lead; do not reuse its cursor for another resource. Polling itself
never starts a conversation. A lead must first be explicitly assigned to owner
`3`/`Hutoxy Pilot`; there is no historical backfill or automatic reassignment.

### Customer-message relay

Existing authenticated Interakt processing already records inbound messages as
CRM WhatsApp interactions. Hutoxy subscribes to those records, not to Interakt's
account-level webhook. `GET /leads/{ref}/messages` returns entries such as:

```json
{"data":[{"id":"interaction-id","type":"WhatsApp","timestamp":"2026-10-27T10:00:00Z","content":{"direction":"in","text":"We need two tents","actor":"Interakt","message_id":"provider-id","media_url":null}}],"next_cursor":null,"request_id":"..."}
```

Media fields depend on what Interakt supplied and the existing CRM recorded.
`customer.message` webhook payloads contain the same message under
`data.message`. Treat this as a normalized CRM relay, not the original raw
Interakt body. Human-agent/outbound messages and status-only records do not
produce `customer.message` events. Only messages logged after the webhook is
enabled produce new events; polling can read already-recorded messages.

### Log an outbound message

Send after Interakt confirms the actual send. Require a unique
`Idempotency-Key` header of 8-200 characters:

```http
POST /leads/TTE-EXAMPLE/messages
x-api-key: <from your bot host secret store>
Idempotency-Key: hutoxy-message-provider-id
Content-Type: application/json

{"direction":"out","text":"Your quotation is ready.","time":"2026-10-27T10:00:00Z"}
```

`time` is optional. ISO timestamps may not be more than five minutes in the
future. The API accepts outbound logs only; do not repost customer messages.
Response `data` includes `id`, `lead_id`, `ref_id`, `timestamp`,
`recorded:true`, and **`sent:false`**. A repeated key with the same normalized
body returns the original record. A different body returns 409
`idempotency_conflict`. This route cannot call Interakt.

### Log a quotation

```json
{"category":"Premium Tent","check_in":"2027-01-12","nights":3,"rooms":1,"pax":{"adults":2,"children_under_6":0},"total":55000,"discount_percent":0,"pdf_url":"https://your-approved-media-host/quote.pdf"}
```

POST this to `/leads/{ref}/quotes` with `Idempotency-Key`. `category`,
`check_in`, `nights`, `rooms`, `pax`, and `total` are required. Optional:
`discount_percent` (defaults to 0), HTTPS `pdf_url`, ISO `created_at`.
`pax` can alternatively be a numeric adult count. Use the engine's calculated
amount for `total`; the example above illustrates the schema, not a tariff.
This creates a Note with actor `Hutoxy Pilot` and kind `quote`. It logs the
quote, not a booking/payment/hold, and does not send a document.

### Generate a quotation PDF

Use the existing Tent City rate engine and PDF design:

```json
{"lead_ref":"TTE-EXAMPLE","check_in":"2027-01-12","nights":3,"rooms":1,"category":"Premium Tent","occupancy":"double","extra_mattresses":0,"children_under_6":0,"discount_percent":0}
```

POST to `/rann/quote`, `/rann/quote/pdf`, or `/rann/quote/pdf-link`.
`lead_ref` must resolve to an eligible pilot lead; its name/reference are used
on the document. Optional `option_categories` requests category comparisons.
PDF-link generation returns a random public URL; anyone holding that URL can
read the quote. Each call creates a new file. `expires_at` is the existing
seven-day retention target, not a guaranteed signed-link expiry; shared quote
storage housekeeping performs eventual cleanup. Retry consciously to avoid
unnecessary files. Binary PDFs above 4.4 MB require the PDF-link route.

Tent City supports **1-3 nights**. Four-night and other-product enquiries need
an agreed handover or separately supported quotation workflow; this CRM
preparation does not approve that business policy. The calculator accepts a
discount input but does not approve a discount policy.

### Availability: exact endpoint and limits

```text
GET https://ttecrm.vercel.app/api/hutoxy/v1/availability?check_in=2027-01-12&nights=3&category=Premium%20Tent
```

Categories can also use IDs: 161 Non-AC, 162 Deluxe AC, 163 Premium,
164 Super Premium, 165 Rajwadi, 166 Darbari. Response fields include
`tents_left`, `supplier_available`, `crm_held`, `checked_at`,
`source:"saved_supplier_snapshot"`, **`live:false`**, and `hold_created:false`.
A missing snapshot returns 404 `availability_not_checked`. It never refreshes
supplier inventory or creates a hold. Check freshness and ask staff to refresh
if necessary; an under-10 action rule remains a business decision.

## Owner-scoped webhooks and triggers

Three independently queued events are available:

- `lead.created`: an eligible lead is created already assigned to Hutoxy.
- `lead.assigned`: a lead actually moves to Hutoxy from another resolved owner.
- `customer.message`: a new inbound WhatsApp interaction is recorded for an
  eligible, open Hutoxy lead.

No change is made to MAX's existing Interakt webhook, receiver, credentials,
queue, or cron. The separate Hutoxy worker runs every minute at
`/api/hutoxy-worker`. Won/Lost leads do not emit/send new pilot events.
WhatsApp Click creation/assignment events have a five-minute minimum delay;
customer-message events do not. Other events run on the next worker tick.
Equivalent owner-name/ID writes do not create duplicate assignment events.
No existing leads are bulk assigned and no historical events are backfilled.

The receiver developer must provide a public HTTPS endpoint accepting POST.
Configure only this pilot, using its key:

```json
{"target_url":"https://your-bot-host.example/webhooks/hutoxy","enabled":false}
```

PATCH `/automation/settings`, run the connection test, and enable with
`{"enabled":true}` when the receiver is ready. The server rejects private
addresses, non-HTTPS URLs and redirects. The pilot API key cannot change the
owner, allowed test phone, or `test_only` setting.

Payload:

```json
{"id":"stable-event-uuid","event":"lead.assigned","occurred_at":"2026-10-27T10:00:00Z","data":{"id":"lead-uuid","ref_id":"TTE-EXAMPLE","owner":"3","owner_name":"Hutoxy Pilot","name":"Test Guest","contact":{"phone":"+919601070220","email":""},"trip":{"destination":"Rann Utsav"}}}
```

Headers:

```text
X-TTE-Event: lead.assigned
X-TTE-Event-Id: stable-event-uuid
X-TTE-Signature: t=<unix-seconds>,v1=<hex-HMAC-SHA256>
```

Signature input is **timestamp + "." + exact raw JSON body**, using the separate
`HUTOXY_WEBHOOK_SIGNING_SECRET`. Check it in constant time with a short clock
skew tolerance. Deduplicate by event UUID. Delivery is at least once: 10-second
HTTP timeout; up to 10 attempts; retries start at 60 seconds and back off to a
six-hour cap. A receiver may have accepted a timed-out request. Pause cancels
pending deliveries; an HTTP request already sent cannot be recalled. Last
HTTP status and error are available through `/automation/deliveries`.

`POST /automation/test` takes `{}` and sends `event:"connection.test"`,
`test:true`, `dry_run:true`, and a null customer phone. It does not contact a
customer, create a lead, invoke MAX, or send WhatsApp. Without a configured
receiver, it returns 409 `webhook_not_configured`.

## What the bot developer and Avnish still decide

Receiver hosting/URL and secret-store access; Interakt credentials, number
routing and send permissions; customer-facing identity and TTE mention;
approved template name/language/text; discounts and availability rules;
handover employee/desk group; choice of brochure; four-night policy; and the
explicit later approval to lift test-only mode. Shared-number conversation
ownership must be coordinated on the bot side to prevent competing replies.

Existing public assets (selection/approval remains with Avnish):

- https://ttecrm.vercel.app/files/Rann-Utsav-Brochure.pdf
- https://ttecrm.vercel.app/files/Tent-City-Timelapse-WhatsApp.mp4

## Verification

`node scripts/test-hutoxy-pilot.mjs` tests the isolated API and worker with
mocked records and receiver calls. `scripts/verify-hutoxy-pilot.sql` runs in a
transaction ending ROLLBACK, with only disposable synthetic records. Existing
MAX, Interakt relay, Sonali, Jigar, and Prakash regressions run separately.
No real customer is messaged during CRM verification.
