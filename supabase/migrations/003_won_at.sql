-- ============================================================
-- TTE Travel CRM - Canonical "sale month" attribution
-- Run this in: Supabase Dashboard → SQL Editor → New Query
--
-- Revenue/Net Profit on the Dashboard now attribute a deal to the month it
-- was actually WON, not the month the lead was first created. won_at is
-- stamped once — the first time a lead's status becomes "Won" — and never
-- overwritten afterwards, so cycling a deal out of Won and back in can't
-- shift which month it's credited to.
-- ============================================================

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS won_at timestamptz;
