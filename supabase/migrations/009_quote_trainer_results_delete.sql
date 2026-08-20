-- ============================================================
-- TTE Travel CRM — Quote Trainer: allow deleting a session
-- Run this in: Supabase Dashboard → SQL Editor → New Query
--
-- 008_quote_trainer_results.sql only granted INSERT and SELECT — there was
-- no way to remove a bad session (a genuine data-entry slip, a test run,
-- etc.) once saved, and a wrong session drags down someone's average time
-- and accuracy permanently. Admin-only deletion is enforced in the app
-- (the delete button only renders for user.role === 'admin' — see
-- pages/QuoteTrainerPractice.tsx), the same way Team Settings and every
-- other admin-gated action in this app works: this schema's custom-JWT
-- auth doesn't carry a role claim RLS could check, so — same posture as
-- 008's SELECT/INSERT policies — this stays permissive within
-- `authenticated` rather than trying to enforce it at the database layer.
-- ============================================================

DROP POLICY IF EXISTS "authenticated_delete_quote_trainer_results" ON quote_trainer_results;
CREATE POLICY "authenticated_delete_quote_trainer_results" ON quote_trainer_results
  FOR DELETE TO authenticated USING (true);
