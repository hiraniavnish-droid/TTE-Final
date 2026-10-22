# Sonali Rann Utsav webhook

An independent subscription in Team Settings. It ships **paused with no destination URL**. No historical leads are backfilled. Enabling requires a public HTTPS URL and a saved secret. Pausing cancels pending/in-flight queue records; events occurring while paused are not retained. A request already on the network cannot be recalled.

## Matching and events

The subscription resolves the single agent named Sonali at installation (production user ID `2`) and stores her immutable CRM user ID. Match destination from `trip_details.destination`, falling back to the legacy `destination` column. Case-insensitive, word-boundary matching includes Rann Utsav, Rann Tent Resort, Rann Resort, White Rann and Namak/Namuk. Source website does not restrict eligibility. Closed Won/Lost leads do not receive intros.

- `lead.created`: inserted with Sonali as owner and an eligible destination.
- `lead.assigned`: ownership actually changes to Sonali on an existing eligible lead.
- Unrelated edits and repeated writes of the same owner do not emit events.
- Moving away cancels pending records. Moving back is a new assignment event.
- Destination-only changes do not create events, but an ineligible destination cancels pending delivery.

Each event receives a stable UUID, reused on retries. The creation dedupe key is unique per lead; each real assignment transition gets its own dedupe key. Receivers **must deduplicate by event UUID**: delivery is at least once, and a timeout after receiver acceptance can cause a retry.

## WhatsApp Click gate

Sources beginning with `WhatsApp Click` (case-insensitive and trimmed) wait at least five minutes **from the qualifying creation or assignment event**. The minute worker can add scheduling latency. At dispatch, check the current owner, destination, open status and enabled state again.

Use the existing MAX intro suppression policy independently: cancel on a customer timestamp after lead creation minus three hours, any recorded bot timestamp, a matching phone seen by Interakt in the last three hours, or a matching-phone inbound WhatsApp interaction in the last three hours. Thus an already active conversation will not receive another intro.

## Payload

```json
{
  "id": "stable-event-uuid",
  "event": "lead.assigned",
  "occurred_at": "2026-10-22T06:30:00Z",
  "data": {
    "id": "internal-lead-uuid",
    "ref_id": "TTE-1530",
    "name": "Example Guest",
    "phone": "+919000000000",
    "source": "WhatsApp Click - rannutsavtickets.in",
    "status": "New",
    "owner": "2",
    "owner_name": "Sonali",
    "previous_owner": "admin",
    "destination": "Rann Utsav",
    "trip": {"destination":"Rann Utsav"},
    "created_at": "2026-10-22T06:25:00Z",
    "crm_url": "https://ttecrm.vercel.app/#/leads/internal-lead-uuid"
  }
}
```

Payload is rebuilt from the current lead immediately before delivery. `previous_owner` is null for creation. Names and phone numbers are not included in the admin delivery log.

## Signing and reliability

- `X-TTE-Event`: event name.
- `X-TTE-Event-Id`: stable event UUID.
- `X-TTE-Signature`: `t=<unix seconds>,v1=<hex HMAC-SHA256(secret, timestamp + "." + raw request body)>`.

Verify the signature over the unmodified raw body with a constant-time comparison and a short timestamp tolerance. The signing secret is separate from MAX. Generate a replacement in Settings, show/copy it to the receiver securely, then Save. Existing saved secrets cannot be retrieved through the browser API. No MAX authorization header is sent. An independent receiver token may be configured through the encrypted production environment variables `SONALI_WEBHOOK_AUTHORIZATION` and `SONALI_WEBHOOK_AUTH_TARGET_URL`. The Authorization header is sent only when the validated target exactly matches the pinned URL. Changing the destination in Settings cannot disclose the token to another receiver.

Public HTTPS only; private DNS/IP targets and redirects are rejected. Requests time out after ten seconds. Durable leases and `FOR UPDATE SKIP LOCKED` prevent concurrent claims. Non-2xx/network failures retry up to ten attempts, starting at 60 seconds with exponential backoff capped at six hours. Last HTTP status/error remain visible in Settings; cancelled/failed events are not automatically replayed.

## Isolation and administration

- API: `/api/sonali-webhook-settings` (GET/POST), live admin session required.
- Tables: `crm_sonali_webhook_settings`, `crm_sonali_webhook_outbox`; RLS enabled, no anon/authenticated table grants.
- All privileged queue/settings RPCs are service-role-only. The lead trigger needs SECURITY DEFINER to write private queue records during normal lead saves; its function cannot be called through public roles.
- Existing minute worker adds an independent queue branch; a Sonali queue failure does not prevent processing MAX or Interakt.
- No MAX setting, database function, queue, event eligibility or authorization configuration is changed. The existing payload helper is reused read-only.

Verification: `node scripts/test-sonali-webhook.mjs`; `scripts/verify-sonali-webhook.sql` inside a transaction followed by ROLLBACK. Never commit the synthetic test leads or invoke a real receiver during tests.

## Three team routes (22 October 2026)

Team Settings now has Sonali, Jigar and Prakash cards. Each has independent settings, a randomly generated signing secret, an optional password-only Bearer token input, enable/pause and its own outbox/RPCs. Routes and tables use `sonali`, `jigar` or `prakash` in the corresponding names. Jigar and Prakash were installed paused with no URL or Bearer token. Sonali retains her existing active URL and encrypted environment token.

All three require a recorded source website of exactly `rannutsav.in` or `rannutsavtickets.in`, in addition to the owner and Rann destination filters. Canonical source labels (`Website - ...`, `WhatsApp Click - ...`, `Form - ...`, `Email - ...`, `Manual - ...`) and exact domain/URL values normalize to a domain. `www.` and case variations normalize; unrelated hosts, deceptive suffixes and ambiguous labels such as `Website` or `Website - Rann Utsav` are excluded. Website attribution is never inferred from destination, owner, free-text notes or phone. No historical backfill is performed.

The outgoing payload adds **`data.source_website`** with `rannutsav.in` or `rannutsavtickets.in`, while retaining `data.source` as the original source label. Source website is checked both on enqueue and immediately before delivery; disallowed queued events are cancelled during installation.

Only WhatsApp Click sources have the five-minute minimum hold. Eligible form, email and manual events are due immediately and run on the next minute worker tick. Existing WhatsApp intro cancellation checks are unchanged. All three retain stable event IDs on retries and require receiver-side deduplication.

Bearer tokens saved in Settings are server-only, stored in the private settings table and pinned to the destination saved alongside them. They are not returned through GET or included in the webhook JSON. Replacing a URL without its new token does not send the old token to the new URL. Sonali's existing pinned environment token remains a fallback when no matching database token exists. No main-bot token or settings are shared with these routes.

Checks: `node scripts/test-team-rann-webhooks.mjs`, existing Sonali settings/delivery tests, production build and `scripts/verify-team-rann-webhooks.sql` in a rolled-back migration transaction. UI uses the existing Card/Button/theme primitives and was checked at desktop and mobile widths with mocked settings only.

## Sonali owner identity compatibility fix (22 October 2026)

The legacy website intake and agent UI store owner names in `leads.assigned_to`, while the Sonali subscription pins a user ID. Sonali's enqueue and preflight now resolve either representation through the service-only `crm_team_owner_user_id(text)` helper. Exact IDs take priority; a name must match exactly one user (case-insensitive and trimmed). Unrecognised or ambiguous names fail closed. An equivalent name-to-ID edit does not create another assignment event or cancel an existing one. The outgoing `data.owner` remains the canonical user ID and `data.owner_name` is resolved from that ID.

No lead owner values are rewritten. Website/destination restrictions, WhatsApp holds, retries and the main MAX webhook remain unchanged. This patch changes Sonali's functions only; the other team routes are outside this fix's scope. Test `scripts/verify-sonali-owner-identity.sql` within the migration transaction followed by ROLLBACK, without dispatching fixtures. Historical missed events are not automatically backfilled.
