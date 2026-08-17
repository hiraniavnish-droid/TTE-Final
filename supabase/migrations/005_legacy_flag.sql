-- ============================================================
-- TTE Travel CRM - Legacy (old-company) deal flag
-- Run this in: Supabase Dashboard → SQL Editor → New Query
--
-- The business changed ownership; new bank accounts run from 2 Jul 2026.
-- Old-company deals must stay visible (same team, same customers) but be
-- excluded from every financial aggregate: pending collections, outstanding
-- balances, vendor owed, revenue/profit on the Dashboard and WhatsApp
-- summaries. Admin can toggle the flag per lead from the app for any deal
-- "handled differently". The Payments page remains a raw transaction ledger
-- and is deliberately NOT filtered by this flag.
-- ============================================================

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS legacy boolean NOT NULL DEFAULT false;

-- One-time backfill: all 30 Won deals dated before 2 Jul 2026 (won_at, falling back to
-- created_at for leads won before that field existed) — reviewed and confirmed with the
-- business owner on 2026-07-26.
UPDATE leads
SET legacy = true
WHERE status = 'Won'
  AND COALESCE(won_at, created_at) < '2026-07-02T00:00:00Z';
