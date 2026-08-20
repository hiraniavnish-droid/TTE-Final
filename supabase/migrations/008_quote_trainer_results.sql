-- ============================================================
-- TTE Travel CRM — Quotation Trainer results
-- Run this in: Supabase Dashboard → SQL Editor → New Query
--
-- One row per completed practice session (not per question — the trainee's
-- own summary view never shows individual questions, per design; `detail`
-- below is for admin/debugging only and is never rendered to the trainee).
--
-- avg_time_correct_sec is computed by the APP over CORRECT answers only —
-- a wrong answer means the trainee never reached a real number, so timing
-- it would just reward fast guessing. NULL when a session had zero correct
-- answers (nothing to average).
--
-- users.id is a short client-generated string (utils/helpers.ts
-- generateId()), not a uuid — matches every other TEXT-keyed table in this
-- schema (interactions, reminders, activity_logs).
-- ============================================================

CREATE TABLE IF NOT EXISTS quote_trainer_results (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_name TEXT NOT NULL,           -- denormalised so history survives a renamed/removed user
  mode TEXT NOT NULL,                -- '10min' | '15min' | '10q' | '15q' | '20q' | 'untimed'
  attempted INT NOT NULL,
  correct INT NOT NULL,
  accuracy NUMERIC NOT NULL,         -- 0-100, correct/attempted
  avg_time_correct_sec NUMERIC,      -- NULL when correct = 0
  detail JSONB,                      -- per-question outcomes, admin-only, never shown to the trainee
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS quote_trainer_results_user_id_idx ON quote_trainer_results(user_id);
CREATE INDEX IF NOT EXISTS quote_trainer_results_created_at_idx ON quote_trainer_results(created_at DESC);

-- ─── RLS ─────────────────────────────────────────────────────
-- Same posture as the rest of the modern (post-hardening) schema: the
-- client only ever holds the anon key + a server-minted session bearer
-- token (lib/supabase.ts), which PostgREST maps to the `authenticated`
-- role — see 006_lead_code.sql's note on the same mechanism. Every logged-in
-- team member can log their own runs and see everyone's (a shared training
-- leaderboard, not private data), so this stays permissive within
-- `authenticated` rather than trying to scope inserts to auth.uid(), which
-- this app's custom-JWT auth doesn't populate the way Supabase Auth would.
ALTER TABLE quote_trainer_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_insert_quote_trainer_results" ON quote_trainer_results;
CREATE POLICY "authenticated_insert_quote_trainer_results" ON quote_trainer_results
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_select_quote_trainer_results" ON quote_trainer_results;
CREATE POLICY "authenticated_select_quote_trainer_results" ON quote_trainer_results
  FOR SELECT TO authenticated USING (true);

-- ─── Verify ──────────────────────────────────────────────────
-- Expect: one row, all zero until the first practice session is saved.
SELECT COUNT(*) AS total_sessions FROM quote_trainer_results;
