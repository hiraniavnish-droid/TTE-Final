-- ============================================================
-- TTE Travel CRM — App-wide settings (starting with lead auto-assignment)
-- Run this in: Supabase Dashboard → SQL Editor → New Query
--
-- api/leads.ts previously hardcoded every inbound Rann Utsav website/bot
-- lead to DEFAULT_ASSIGNEE = 'Sonali'. That required a code change (and a
-- deploy) every time the business wanted to pause auto-assignment or hand
-- it to someone else — this table makes it a Team Settings toggle instead.
--
-- Single-row table, same pattern as lead_code_counter (006_lead_code.sql):
-- one row, locked to existing by the boolean PK + CHECK, updated in place
-- rather than inserted/deleted.
-- ============================================================

CREATE TABLE IF NOT EXISTS app_settings (
  id BOOLEAN PRIMARY KEY DEFAULT TRUE,
  auto_assign_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  auto_assign_to TEXT,               -- team member name (matches leads.assigned_to's convention — a name, not an id); NULL = nobody picked yet
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT app_settings_singleton CHECK (id)
);

-- Seed with the exact current hardcoded behavior so nothing changes for
-- existing leads until someone deliberately edits it in Team Settings.
INSERT INTO app_settings (id, auto_assign_enabled, auto_assign_to)
VALUES (TRUE, TRUE, 'Sonali')
ON CONFLICT (id) DO NOTHING;

-- ─── RLS ─────────────────────────────────────────────────────
-- This app's custom-JWT auth (lib/supabase.ts) sends the minted session
-- token as the Bearer, which Supabase evaluates as the `authenticated`
-- role — same posture as quote_trainer_results / lead_attachments (008,
-- 010). api/leads.ts itself reads this with the service-role key, which
-- bypasses RLS entirely, so these policies only govern the Team Settings
-- page's direct read/update.
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_select_app_settings" ON app_settings;
CREATE POLICY "authenticated_select_app_settings" ON app_settings
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "authenticated_update_app_settings" ON app_settings;
CREATE POLICY "authenticated_update_app_settings" ON app_settings
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ─── Verify ──────────────────────────────────────────────────
SELECT * FROM app_settings;
