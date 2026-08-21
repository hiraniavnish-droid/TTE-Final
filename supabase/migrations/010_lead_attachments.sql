-- ============================================================
-- TTE Travel CRM — Lead attachments (hotel vouchers, payment bills, etc.)
-- Run this in: Supabase Dashboard → SQL Editor → New Query
--
-- Named lead_attachments, deliberately NOT "documents" — a `documents` table
-- already exists in this schema (see 007_lead_fk_constraints.sql's RESTRICT
-- policy note) for the sequential GST invoice/receipt system, a different
-- concept (auto-generated, numbered, legally must survive lead deletion).
-- This table is free-form file uploads an agent attaches to a lead — a
-- confirmation voucher from a hotel, a payment screenshot, etc. Deleting one
-- is a normal user action here, not something that should ever be blocked.
--
-- The actual file bytes live in Cloudflare R2 (bucket: tte-crm-documents),
-- not in Supabase Storage or this table — this row is just the pointer
-- (r2_key) plus metadata. Upload/delete/presigned-URL generation all happen
-- server-side via Edge Functions (upload-attachment, attachment-url,
-- delete-attachment) so the R2 credentials never reach the browser.
--
-- leads.id is uuid (converted from text in 007_lead_fk_constraints.sql),
-- so lead_id here is uuid too, unlike users.id (still a short TEXT id from
-- utils/helpers.ts generateId()) — matches the two different id schemes
-- already in use across this schema.
-- ============================================================

CREATE TABLE IF NOT EXISTS lead_attachments (
  id TEXT PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,          -- original filename, as uploaded
  doc_type TEXT NOT NULL,          -- 'Hotel Voucher' | 'Payment Bill' | 'ID Proof' | 'Other' — free text, not enforced
  r2_key TEXT NOT NULL,            -- object key inside the R2 bucket, e.g. leads/<lead_id>/<id>-<filename>
  content_type TEXT,
  file_size INT,
  uploaded_by TEXT,                -- user name, denormalised like quote_trainer_results.user_name
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS lead_attachments_lead_id_idx ON lead_attachments(lead_id);
CREATE INDEX IF NOT EXISTS lead_attachments_created_at_idx ON lead_attachments(created_at DESC);

-- ─── RLS ─────────────────────────────────────────────────────
-- Same posture as quote_trainer_results (008_quote_trainer_results.sql):
-- this app's custom-JWT auth has no role claim RLS could check, so this
-- stays permissive within `authenticated` — admin/uploader-only UI gating
-- (if any) happens client-side, matching every other admin-gated action in
-- this app.
ALTER TABLE lead_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_select_lead_attachments" ON lead_attachments;
CREATE POLICY "authenticated_select_lead_attachments" ON lead_attachments
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "authenticated_insert_lead_attachments" ON lead_attachments;
CREATE POLICY "authenticated_insert_lead_attachments" ON lead_attachments
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_delete_lead_attachments" ON lead_attachments;
CREATE POLICY "authenticated_delete_lead_attachments" ON lead_attachments
  FOR DELETE TO authenticated USING (true);

-- Inserts/deletes actually happen via the service-role key inside the Edge
-- Functions (upload-attachment / delete-attachment), which bypasses RLS
-- entirely — these policies exist so the frontend's direct SELECT (listing
-- a lead's attachments) works under the anon+bearer-token client.

-- ─── Verify ──────────────────────────────────────────────────
-- Expect: one row, count 0 until the first file is uploaded.
SELECT COUNT(*) AS total_attachments FROM lead_attachments;
