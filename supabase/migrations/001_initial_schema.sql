-- ============================================================
-- TTE Travel CRM - Initial Schema Migration
-- Run this in: Supabase Dashboard ‚Üí SQL Editor ‚Üí New Query
-- ============================================================

-- ============================================================
-- 1. FIX LEADS TABLE ‚Äî Add missing columns
-- ============================================================
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS temperature TEXT DEFAULT 'Warm',
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'Other',
  ADD COLUMN IF NOT EXISTS contact JSONB,
  ADD COLUMN IF NOT EXISTS trip_details JSONB,
  ADD COLUMN IF NOT EXISTS preferences JSONB,
  ADD COLUMN IF NOT EXISTS commercials JSONB,
  ADD COLUMN IF NOT EXISTS vendors JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS interested_services TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS reference_name TEXT,
  ADD COLUMN IF NOT EXISTS last_status_update TIMESTAMPTZ;

-- ============================================================
-- 2. INTERACTIONS TABLE
-- Note: lead_id is TEXT with no FK constraint to avoid type
-- mismatch with leads.id (uuid). App handles referential integrity.
-- ============================================================
CREATE TABLE IF NOT EXISTS interactions (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL,
  type TEXT NOT NULL,       -- 'Call' | 'Note' | 'Email' | 'StatusChange' | 'TaskLog'
  content TEXT NOT NULL,
  sentiment TEXT,           -- 'Positive' | 'Neutral' | 'Negative'
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS interactions_lead_id_idx ON interactions(lead_id);
CREATE INDEX IF NOT EXISTS interactions_timestamp_idx ON interactions(timestamp DESC);

-- ============================================================
-- 3. REMINDERS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS reminders (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL,
  task TEXT NOT NULL,
  due_date TIMESTAMPTZ NOT NULL,
  is_completed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS reminders_lead_id_idx ON reminders(lead_id);
CREATE INDEX IF NOT EXISTS reminders_due_date_idx ON reminders(due_date);

-- ============================================================
-- 4. ACTIVITY LOGS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS activity_logs (
  id TEXT PRIMARY KEY,
  agent_name TEXT NOT NULL,
  action_type TEXT NOT NULL, -- 'NEW_LEAD' | 'STATUS_CHANGE' | 'COMMENT'
  details TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  lead_id TEXT,
  metadata JSONB DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS activity_logs_lead_id_idx ON activity_logs(lead_id);
CREATE INDEX IF NOT EXISTS activity_logs_timestamp_idx ON activity_logs(timestamp DESC);

-- ============================================================
-- 5. SUPPLIERS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS suppliers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  destinations TEXT[] DEFAULT '{}',
  category TEXT,             -- 'DMC' | 'Hotelier' | 'Transport' | 'Visa'
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 6. ENABLE ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 7. RLS POLICIES
-- App uses custom passcode auth (not Supabase Auth), so policies
-- use the anon role. Migrate to Supabase Auth later for per-user
-- row-level security.
-- ============================================================

-- Drop existing policies if re-running
DROP POLICY IF EXISTS "anon_all_leads" ON leads;
DROP POLICY IF EXISTS "anon_all_interactions" ON interactions;
DROP POLICY IF EXISTS "anon_all_reminders" ON reminders;
DROP POLICY IF EXISTS "anon_all_activity_logs" ON activity_logs;
DROP POLICY IF EXISTS "anon_all_suppliers" ON suppliers;

-- Create permissive policies for anon role
CREATE POLICY "anon_all_leads" ON leads FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_interactions" ON interactions FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_reminders" ON reminders FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_activity_logs" ON activity_logs FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_suppliers" ON suppliers FOR ALL TO anon USING (true) WITH CHECK (true);

-- ============================================================
-- DONE ‚Äî Verify with:
--   SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';
--   SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';
-- ============================================================
