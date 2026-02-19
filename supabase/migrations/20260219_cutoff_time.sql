-- ═══════════════════════════════════════════════════════════
-- Add cutoff_time to daily_loads
-- Migration: 20260219_cutoff_time.sql
-- Adds the airline cutoff time column — the maximum delivery
-- time before the flight is missed.
-- ═══════════════════════════════════════════════════════════

ALTER TABLE daily_loads ADD COLUMN IF NOT EXISTS cutoff_time TIMESTAMPTZ;
COMMENT ON COLUMN daily_loads.cutoff_time IS 'Airline cutoff — maximum delivery time before flight is missed';
