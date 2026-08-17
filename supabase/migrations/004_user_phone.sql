-- ============================================================
-- TTE Travel CRM - Team WhatsApp notifications
-- Run this in: Supabase Dashboard → SQL Editor → New Query
--
-- Lead-update notifications (new lead / assignment / payment received) are
-- sent to every team member individually via Interakt WhatsApp DM. That
-- needs each user's own WhatsApp number. Left NULL = that user simply
-- doesn't receive notifications.
-- ============================================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS phone text;
