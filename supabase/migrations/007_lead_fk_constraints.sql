-- ============================================================
-- TTE Travel CRM — Real foreign keys on lead_id
--
-- 001_initial_schema.sql:25 left lead_id as plain TEXT with no FK "to avoid
-- type mismatch with leads.id (uuid). App handles referential integrity."
-- It didn't: an audit on 2026-07-28 found 11 orphaned payment rows, including
-- a duplicated Rs 1,70,911 record that was inflating the Payments page total
-- (pages/Payments.tsx:99 sums ALL records, not just ones with a live lead).
-- Those were backed up to backups/orphaned-payments-removed-2026-07-28.json
-- and removed. This migration makes the problem structurally impossible.
--
-- RUN 006_lead_code.sql FIRST. Run this in: SQL Editor → New Query.
--
-- Policy per table, chosen by what the data means:
--   payments   → RESTRICT : never let a lead with money attached be deleted.
--   documents  → RESTRICT : GST invoices/receipts must survive; deleting the
--                           lead out from under an issued number breaks the
--                           audit trail your CA relies on.
--   reminders  → CASCADE  : a task for a deleted lead is meaningless.
--   interactions → left alone ON PURPOSE, see section 4.
-- ============================================================

-- ─── 0. PRE-FLIGHT — must all return 0 before you continue ──
-- If any row appears here, STOP: the ALTER in step 1 will fail. Re-run the
-- orphan audit and clean up first rather than forcing it.
SELECT 'payments'  AS tbl, COUNT(*) AS bad FROM payments  p WHERE p.lead_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM leads l WHERE l.id::text = p.lead_id)
UNION ALL
SELECT 'reminders', COUNT(*) FROM reminders r WHERE r.lead_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM leads l WHERE l.id::text = r.lead_id)
UNION ALL
SELECT 'documents', COUNT(*) FROM documents d WHERE d.lead_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM leads l WHERE l.id::text = d.lead_id)
UNION ALL
-- also catches any value that isn't even a valid uuid, which would break the cast
SELECT 'non-uuid values', COUNT(*) FROM (
  SELECT lead_id FROM payments  WHERE lead_id IS NOT NULL AND lead_id !~ '^[0-9a-fA-F-]{36}$'
  UNION ALL SELECT lead_id FROM reminders WHERE lead_id IS NOT NULL AND lead_id !~ '^[0-9a-fA-F-]{36}$'
  UNION ALL SELECT lead_id FROM documents WHERE lead_id IS NOT NULL AND lead_id !~ '^[0-9a-fA-F-]{36}$'
) x;

-- ─── 1. TEXT → uuid, so a FK is even possible ───────────────
-- This is the step the original schema avoided. It's safe now that every
-- remaining value is a real uuid pointing at a live lead.
ALTER TABLE payments  ALTER COLUMN lead_id TYPE uuid USING NULLIF(lead_id, '')::uuid;
ALTER TABLE reminders ALTER COLUMN lead_id TYPE uuid USING NULLIF(lead_id, '')::uuid;
ALTER TABLE documents ALTER COLUMN lead_id TYPE uuid USING NULLIF(lead_id, '')::uuid;

-- reminders.lead_id is NOT NULL in 001; keep it that way (a reminder with no
-- lead is meaningless). payments/documents stay nullable — a payment can be a
-- generic link and a document can be an external registration with no lead.

-- ─── 2. The constraints ─────────────────────────────────────
ALTER TABLE payments  DROP CONSTRAINT IF EXISTS payments_lead_id_fkey;
ALTER TABLE payments  ADD  CONSTRAINT payments_lead_id_fkey
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE RESTRICT;

ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_lead_id_fkey;
ALTER TABLE documents ADD  CONSTRAINT documents_lead_id_fkey
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE RESTRICT;

ALTER TABLE reminders DROP CONSTRAINT IF EXISTS reminders_lead_id_fkey;
ALTER TABLE reminders ADD  CONSTRAINT reminders_lead_id_fkey
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE;

-- ─── 3. Keep the lookup indexes ─────────────────────────────
CREATE INDEX IF NOT EXISTS payments_lead_id_idx  ON payments(lead_id);
CREATE INDEX IF NOT EXISTS documents_lead_id_idx ON documents(lead_id);
CREATE INDEX IF NOT EXISTS reminders_lead_id_idx ON reminders(lead_id);

-- ─── 4. interactions — DELIBERATELY NOT CONSTRAINED ─────────
-- contexts/LeadContext.tsx:480 deletes a lead's interactions with
--   .neq('type', 'WhatsApp')
-- i.e. it intentionally preserves WhatsApp history as a durable record of what
-- was actually said to a customer. That leaves 203 rows (across 19 deleted
-- leads) pointing at lead ids that no longer exist — by design, not by bug.
--
-- Adding a FK here would force a choice:
--   * CASCADE  → silently destroys that preserved chat history.
--   * SET NULL → keeps the rows but detaches them; the chat widget filters by
--                leadId, so they'd become invisible anyway, and lead_id would
--                have to be made nullable (it's NOT NULL today).
-- Neither is obviously right, and both change behaviour you deliberately
-- chose. Left as-is pending an explicit decision.

-- ─── 5. Verify ──────────────────────────────────────────────
SELECT tc.table_name, tc.constraint_name, rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.referential_constraints rc USING (constraint_name, constraint_schema)
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name IN ('payments','documents','reminders')
ORDER BY tc.table_name;
