# Interakt relay and WhatsApp Click introductions

POST `https://ttecrm.vercel.app/api/interakt-relay` receives the website’s MAX mirror. Existing CRM webhook URLs are unchanged.

- Interakt must sign the **raw request bytes** with HMAC-SHA256 using the existing production `INTERAKT_WEBHOOK_SECRET`, in `Interakt-Signature: sha256=<hex>`.
- `message_received` / `CustomerMessage` goes into the bundle queue. Signed `message_echo` events are forwarded immediately to the same pinned MAX webhook, as the exact original body with no `relay` bundle object. They do not enter the queue, dedupe table, or customer history. Other signed events return 200 with `dropped`; duplicate customer message IDs return 200 with `duplicate`. Echo delivery failure returns 503 so the website can retry.
- Queueing, dedupe, and WhatsApp history on all matching existing leads are atomic. No lead is created from a message. Media messages are recorded too. Message IDs are remembered for seven days.
- The existing `/api/max-worker` minute cron claims a burst after 60 seconds of inactivity, or after 180 seconds from its first queued message. Typical delivery is 60–120 seconds after the last message, depending on the cron tick.
- The newest Interakt body is preserved, with only a top-level `relay` object added. Its messages have `id`, `text`, `type`, `media_url`, and `received_at_utc`.
- MAX's existing enabled setting and exact `MAX_WEBHOOK_AUTH_TARGET_URL` pin must match. The worker uses `MAX_WEBHOOK_AUTHORIZATION` and `X-Relay: interakt`. Tokens are never stored in the queue or logged.
- Each batch has a two-minute lease. Arrivals during delivery are kept separately. Successful delivery removes only that batch; failure restores it and retries after 60 seconds. After ten attempts the row stays pending with `attempts=10` and is retained for review. Delivery is at least once; MAX should continue deduplicating message IDs after ambiguous network failures.
- The daily seven-day dedupe cleanup is run by the existing minute worker. RLS and service-role-only permissions protect all relay tables and RPC functions.

## WhatsApp Click introductions

Only `lead.created` and `lead.assigned_to_admin` with a case-insensitive trimmed source starting `WhatsApp Click` get a five-minute queue delay. At the existing preflight, cancel with `customer_already_messaged` when the lead has a customer timestamp later than creation minus three hours, a bot timestamp, or the same last-ten-digit phone has relay/inbound history from the last three hours. Website form introductions and follow-up event rules remain unchanged.

## Live routing: preserve the website flow

The owner selected **preserve website flow; relay MAX only** on 12 October 2026. Interakt remains pointed at `https://www.rannutsavtickets.in/api/whatsapp-webhook`, with its existing secret and event settings.

That route verifies the original Interakt signature first. Its new `src/lib/max-relay.mjs` helper forwards CustomerMessage events (including media) and `message_echo` events to the CRM relay, signing the exact raw bytes with the dedicated production `CRM_INTERAKT_RELAY_SECRET`. The CRM accepts either its original Interakt secret or this separate server-hop secret. No Interakt or MAX credential was replaced or sent to a new destination.

The website's existing Hermes forwarding and allowlisted bot flow remain in place. The direct website-to-MAX mirror was removed, so MAX gets its Interakt wakes through the CRM bundle worker. Website forwarding runs in `waitUntil`, retries a transient relay failure once, and never delays or changes the primary bot response. Its two-attempt mirror is best effort if the CRM remains unavailable; monitor failure logs. Other status events are dropped on the website before any relay HTTP request; echoes use the immediate relay path.

Both Vercel projects have the same dedicated sensitive server-hop secret. Deploy the CRM's accepting handler before deploying the website sender when changing that key.

The website change was deployed from an isolated copy of the previous production source: all 331 existing files matched the deployment hashes. Only the webhook route and new relay helper/test changed. Deployment `dpl_JBNrStVcyK2iAnZ9BP1Y5GKiu3FV` is aliased to `www.rannutsavtickets.in`; the three changed files were also synced back to its original local workspace. Its existing Git remote predates the production source, so this was a targeted Vercel CLI deployment rather than replacing production from that older remote branch.

## Verification

- `node scripts/test-interakt-relay.mjs`
- `node scripts/test-max-automation.mjs`
- In staging or before cutover with an empty relay queue, run migration + `scripts/verify-interakt-relay-db.sql` in a transaction ending **ROLLBACK**, not commit. These create disposable fixtures and must never dispatch HTTP.
- For real delivery testing, use only synthetic numbers with no matching customer leads, and inspect worker status plus the queued batch. Never send test messages to an actual customer's WhatsApp account.

## Operations / rollback

Inspect `crm_interakt_relay` rows with `attempts >= 10` and `last_error`. After fixing the receiver, reset the chosen row's attempts and next_attempt_at to retry. Do not delete a retained batch unless intentionally discarding those messages.

To roll back this preserved-flow routing, restore the website webhook route from its previous deployment (`dpl_334H8PrB3cWAtFw1jzPm772KqhWn`) and redeploy it; Interakt itself remains unchanged. Account for any pending CRM relay messages before restoring the direct mirror to avoid duplicate delivery. To remove the introduction delay, drop trigger `crm_max_click_delay` on `crm_max_outbox`; use `scripts/rollback-interakt-click.sql` to restore the previous preflight if cancellation is also to be removed. Already-delayed pending introductions retain their due dates. Leave relay tables intact until any queued messages have been accounted for.
