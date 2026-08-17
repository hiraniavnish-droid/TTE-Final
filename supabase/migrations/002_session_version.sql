-- ============================================================
-- TTE Travel CRM - Session revocation support
-- Run this in: Supabase Dashboard → SQL Editor → New Query
--
-- Login tokens are stateless signed JWTs (30-day expiry) with no session
-- registry, so an already-issued token can't be revoked. This column lets
-- the app invalidate every existing session for a user on demand ("log out
-- everywhere"): bump the number, and any token minted with an older
-- session_version is rejected on its next check.
-- ============================================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS session_version integer NOT NULL DEFAULT 1;
