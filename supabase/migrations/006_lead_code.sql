-- ============================================================
-- TTE Travel CRM — Human-readable lead codes (TTE-0001, TTE-0002, …)
-- Run this in: Supabase Dashboard → SQL Editor → New Query
--
-- SAFE / ADDITIVE: leads.id (uuid) stays the primary key and is NOT touched.
-- Nothing that references a lead changes. This only adds a display code.
--
-- Why the uuid must stay:
--   * api/razorpay-link.ts bakes leads.id[0:8] into the Razorpay payment
--     reference (TTE-7a11b015-…). Those references live on Razorpay's side
--     and on already-issued customer receipts — they cannot be rewritten.
--   * interactions/reminders/payments/documents.lead_id are TEXT with NO
--     foreign key (see 001_initial_schema.sql:25). Changing the PK would
--     silently orphan those rows instead of raising an error.
--
-- Idempotent: safe to re-run. Backfill only touches rows where lead_code
-- IS NULL, so re-running never renumbers an existing lead.
-- ============================================================

-- ─── 1. The column ──────────────────────────────────────────
ALTER TABLE leads ADD COLUMN IF NOT EXISTS lead_code TEXT;

-- ─── 2. Single-row counter table ────────────────────────────
-- Mirrors the proven approach behind approve_document(): one row that gets
-- row-locked by UPDATE … RETURNING, so concurrent inserts serialise and can
-- never mint the same number twice.
CREATE TABLE IF NOT EXISTS lead_code_counter (
  id         BOOLEAN PRIMARY KEY DEFAULT TRUE,
  last_value BIGINT  NOT NULL DEFAULT 0,
  CONSTRAINT lead_code_counter_singleton CHECK (id)
);

INSERT INTO lead_code_counter (id, last_value)
VALUES (TRUE, 0)
ON CONFLICT (id) DO NOTHING;

-- ─── 3. Backfill existing leads, oldest first ───────────────
-- Chronological so TTE-0001 is genuinely the first lead ever recorded.
-- created_at is the sort key; id breaks ties deterministically.
WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC, id ASC) AS rn
  FROM leads
  WHERE lead_code IS NULL
)
UPDATE leads l
SET lead_code = 'TTE-' || LPAD(o.rn::TEXT, 4, '0')
FROM ordered o
WHERE l.id = o.id;

-- ─── 4. Move the counter past everything just backfilled ────
-- Parses the numeric part back out so the counter is correct even if this
-- migration runs a second time after new leads already exist.
UPDATE lead_code_counter
SET last_value = GREATEST(
  last_value,
  COALESCE((
    SELECT MAX(SUBSTRING(lead_code FROM '[0-9]+$')::BIGINT)
    FROM leads
    WHERE lead_code ~ '^TTE-[0-9]+$'
  ), 0)
)
WHERE id = TRUE;

-- ─── 5. Enforce uniqueness ──────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS leads_lead_code_key ON leads (lead_code);

-- ─── 6. Auto-assign on every future insert ──────────────────
-- A trigger (not app code) because leads are inserted from several places:
-- contexts/LeadContext.tsx addLead + addLeads (CSV bulk), the
-- supabase/functions/leads edge function, and api/rann-enquiry.ts. A
-- DB-level trigger means no insert path — including ones added later — can
-- forget to mint a code.
-- SECURITY DEFINER is REQUIRED here. The app talks to Postgres as the
-- `authenticated` role (lib/supabase.ts sends the anon key + a session bearer
-- token). With RLS enabled on lead_code_counter and no policy granting that
-- role access, a plain SECURITY INVOKER trigger's UPDATE would match zero
-- rows, leave next_val NULL, and 'TTE-' || LPAD(NULL,4,'0') would evaluate to
-- NULL — every new lead would insert SUCCESSFULLY but with no code, silently.
-- SECURITY DEFINER runs the body as the function owner, which bypasses RLS.
-- search_path is pinned so nobody can shadow lead_code_counter with a table
-- of their own on a writable schema (the standard SECURITY DEFINER hardening).
CREATE OR REPLACE FUNCTION assign_lead_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  next_val BIGINT;
BEGIN
  IF NEW.lead_code IS NULL OR NEW.lead_code = '' THEN
    UPDATE lead_code_counter
      SET last_value = last_value + 1
      WHERE id = TRUE
      RETURNING last_value INTO next_val;

    -- Fail loudly rather than writing a NULL code. If the counter row is ever
    -- missing or unreachable we want the insert to error, not to quietly
    -- produce uncoded leads that nobody notices for months.
    IF next_val IS NULL THEN
      RAISE EXCEPTION 'assign_lead_code: lead_code_counter row missing or unreadable';
    END IF;

    NEW.lead_code := 'TTE-' || LPAD(next_val::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS leads_assign_lead_code ON leads;
CREATE TRIGGER leads_assign_lead_code
  BEFORE INSERT ON leads
  FOR EACH ROW
  EXECUTE FUNCTION assign_lead_code();

-- ─── 6b. Lock the counter down ──────────────────────────────
-- RLS ON with deliberately ZERO policies: no client role can read or write
-- the counter directly. Only the SECURITY DEFINER trigger above (and
-- service_role, which bypasses RLS) can touch it. Without this, anyone
-- holding the anon key — which ships inside the public frontend bundle —
-- could bump or reset the counter and corrupt your lead numbering.
ALTER TABLE lead_code_counter ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON lead_code_counter FROM anon, authenticated;

-- ─── 7. Verify ──────────────────────────────────────────────
-- Expect: total = 151 (or current count), nulls = 0, first = TTE-0001.
SELECT
  COUNT(*)                                   AS total_leads,
  COUNT(*) FILTER (WHERE lead_code IS NULL)  AS missing_codes,
  MIN(lead_code)                             AS first_code,
  MAX(lead_code)                             AS last_code
FROM leads;
