# Google Contacts sync

Admin path: **Team Settings → Google Contacts**.

1. Save the Google OAuth web client ID/secret and the Google account whose contacts the phone syncs. The intended account is `booking@thetourismexperts.com`.
2. Click **Connect Google**, choose that account and allow Google Contacts access. Sync turns on after a successful connection.
3. Click **Sync all existing leads** once to import the older CRM records. New leads and edits are queued automatically even while paused.
4. **Pause syncing / Resume syncing** controls background work without stopping lead intake. **Retry failed syncs** requeues failures after the automatic retries are exhausted.
5. Enable Contacts synchronization for the same Google account on the phone. Device/Google sync timing is independent of the CRM worker.

Contacts use the `TTE Leads` label. Names contain lead number, first name, destination code, status and travel date, below 40 characters. `Won` is `Conf`, `Proposal Sent` is `Quote`, and missing dates use `NoDate`. Notes include the full ID, destination, dates, guests and CRM URL. Same-number leads share a contact; its name comes from the newest enquiry and its notes list all matching leads. Existing contact notes, other phone numbers and group labels are preserved. The integration never deletes a Google contact.

## Google Cloud setup

Project: `TTE CRM Contacts` (`utility-inquiry-511607-n0`) in the Tourism Experts Workspace organization. Enable **People API**. In **Google Auth Platform**, create an **Internal** OAuth application for this Workspace organization and a **Web application** client. Authorize exactly:

```
https://ttecrm.vercel.app/api/google-contacts-callback
```

The OAuth flow requests `openid email https://www.googleapis.com/auth/contacts`, offline access, one-time state and PKCE. Account email is checked against Settings; the Google subject is pinned after first connection to prevent cross-account contact-ID reuse. Disconnect stops CRM access but keeps contacts. Remove the app separately from the Google account's connected apps if access must be revoked at Google too. Reconnect the same account to retain saved contact links.

## Backend

Apply migrations `026_google_contacts.sql` and `027_google_contacts_priority.sql`. Configure a random 32-byte base64 `GOOGLE_CONTACTS_ENCRYPTION_KEY` as a **server-only** Vercel environment variable. Preserve it across deploys. Tokens and client secrets are AES-256-GCM encrypted before storage; no token is returned to the browser. Service-role-only tables and RPCs store settings, expiring OAuth states, the contact phone index and the coalescing job queue.

Endpoints added without changing existing URLs:

- `/api/google-contacts`: signed/current admin session required; settings and actions.
- `/api/google-contacts-callback`: validates state cookie, one-use stored state, PKCE, actor session and Google account.
- `/api/google-contacts-worker`: isolated minute cron, authenticated with `CRON_SECRET`.

The lead trigger only enqueues; lead saves make no Google API requests. Google contact IDs are persisted in `leads.google_contact_id`; that update does not requeue itself. One account-wide lease serializes People API writes. A paginated initial contact index and incremental Google sync prevent creating contacts for existing phone numbers. Expired index tokens rebuild the index before more contacts are created. People updates include current source etags to avoid blindly overwriting concurrent edits.

A failed job gets an initial attempt and up to three retries (1, 3, 10 minute delays), then stays failed with a visible error. A newer lead edit supersedes the old revision safely. Missing/invalid phones are skipped and requeued when corrected. Invalid Google refresh grants pause syncing and request reconnection. Backfill is one-time and coalesces existing queued work. New enquiries and edits get priority over historical backfill. Queue/index work uses only the CRM database and Google APIs; it does not call MAX, the Interakt relay or webhooks.

Validation: `node scripts/test-google-contacts.mjs`; build with `npm run build`. Database verification should run in a rollback transaction to test enqueueing, permissions, lease exclusion and no MAX events without retaining test leads.
