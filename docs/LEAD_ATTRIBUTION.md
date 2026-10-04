# Rann Utsav lead attribution

Inbound `/api/leads` stores a human-readable source (channel + domain) and canonical domain tags. The Rann Utsav Tickets sender's existing `website_form`, `whatsapp_click`, `whatsapp_bot`, and `email` keys map to `rannutsavtickets.in`. Main-site `tte_website_form`, `tte_whatsapp_click`, `tte_whatsapp_bot`, and `tte_email` map to `rannutsav.in`. Explicit `tickets_*` aliases remain supported. A recognized page URL/website identifies the site; a distinct `WEBSITE_LEADS_WEBHOOK_SECRET` also identifies the main site when its form builder sends only a generic channel. Unknown domains cannot impersonate either site by substring matching.

Repeat submissions retain the original lead and staff assignment, append deduplicated source/domain tags, and record a new enquiry note. Both website tags can appear when a guest contacts both sites.

The API and Team Settings both parse `lead-routing-v1` stored in `app_settings.auto_assign_to`, alongside legacy plain staff names. Explicit null assignees mean unassigned; routing JSON must never be written to `leads.assigned_to`. The UI also suppresses corrupted routing objects in that field while stored records are repaired.

Historical repair uses explicit intake source tags or an unambiguous Tickets source label. Generic legacy Website records remain unclassified when origin cannot be proved. Changes are backed up locally before applying and use conditional updates so concurrent staff edits are retained.

Validation: `node scripts/verify-lead-attribution.mjs` covers domain/channel mapping, dedicated site credentials, form normalization, structured/legacy routing, unassigned routes, corrupted assignees, repeat submissions, staff assignment preservation, and rejected authentication. The large-dataset browser suite also passes with both site labels and corrupted-assignee fixtures.
