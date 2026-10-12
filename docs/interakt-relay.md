# Interakt relay and WhatsApp Click introductions

POST `https://ttecrm.vercel.app/api/interakt-relay` replaces the direct Interakt → MAX webhook. Existing CRM webhook URLs are unchanged.

- Interakt must sign the **raw request bytes** with HMAC-SHA256 using the existing production `INTERAKT_WEBHOOK_SECRET`, in `Interakt-Signature: sha256=<hex>`.
- Only `message_received` / `CustomerMessage` is accepted into the relay. Other signed events return 200 with `dropped`; duplicate message IDs return 200 with `duplicate`.
- Queueing, dedupe, and WhatsApp history on all matching existing leads are atomic. No lead is created from a message. Media messages are recorded too. Message IDs are remembered for seven days.
- The existing `/api/max-worker` minute cron claims a burst after 60 seconds of inactivity, or after 180 seconds from its first queued message. Typical delivery is 60–120 seconds after the last message, depending on the cron tick.
- The newest Interakt body is preserved, with only a top-level `relay` object added. Its messages have `id`, `text`, `type`, `media_url`, and `received_at_utc`.
- MAX's existing enabled setting and exact `MAX_WEBHOOK_AUTH_TARGET_URL` pin must match. The worker uses `MAX_WEBHOOK_AUTHORIZATION` and `X-Relay: interakt`. Tokens are never stored in the queue or logged.
- Each batch has a two-minute lease. Arrivals during delivery are kept separately. Successful delivery removes only that batch; failure restores it and retries after 60 seconds. After ten attempts the row stays pending with `attempts=10` and is retained for review. Delivery is at least once; MAX should continue deduplicating message IDs after ambiguous network failures.
- The daily seven-day dedupe cleanup is run by the existing minute worker. RLS and service-role-only permissions protect all relay tables and RPC functions.

## WhatsApp Click introductions

Only `lead.created` and `lead.assigned_to_admin` with a case-insensitive trimmed source starting `WhatsApp Click` get a five-minute queue delay. At the existing preflight, cancel with `customer_already_messaged` when the lead has a customer timestamp later than creation minus three hours, a bot timestamp, or the same last-ten-digit phone has relay/inbound history from the last three hours. Website form introductions and follow-up event rules remain unchanged.

## Deployment and Interakt cutover

Apply `supabase/migrations/024_interakt_relay.sql`, then deploy the app. It preserves the live same-day nudge preflight and adds a separate outbox insertion trigger; it does not replace lead-change or follow-up scheduling triggers.

In Interakt Settings → Developer / Webhooks, replace the **direct MAX URL** with the relay URL above and use the same existing `INTERAKT_WEBHOOK_SECRET` value for Interakt's secret. Select incoming customer messages if event selection is offered. Test the signed status event and fake-number burst before switching live traffic. Keep the old endpoint for rollback; do not run a second parallel direct-to-MAX subscription or each customer message may wake MAX twice.

## Verification

- `node scripts/test-interakt-relay.mjs`
- `node scripts/test-max-automation.mjs`
- Run migration + `scripts/verify-interakt-relay-db.sql` in a transaction ending **ROLLBACK**, not commit. These create disposable fixtures and must never dispatch HTTP.
- For real delivery testing, use only synthetic numbers with no matching customer leads, and inspect worker status plus the queued batch. Never send test messages to an actual customer's WhatsApp account.

## Operations / rollback

Inspect `crm_interakt_relay` rows with `attempts >= 10` and `last_error`. After fixing the receiver, reset the chosen row's attempts and next_attempt_at to retry. Do not delete a retained batch unless intentionally discarding those messages.

To roll back routing, point Interakt back at the previous direct MAX webhook. To remove the introduction delay, drop trigger `crm_max_click_delay` on `crm_max_outbox`; use `scripts/rollback-interakt-click.sql` to restore the previous preflight if cancellation is also to be removed. Already-delayed pending introductions retain their due dates. Leave relay tables intact until any queued messages have been accounted for.
