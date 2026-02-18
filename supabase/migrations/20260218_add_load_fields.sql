-- ═══════════════════════════════════════════════════════════
-- Migration: Add Load Fields — AOG Dispatch Form
-- Adds missing fields for the full Add Load flow
-- ═══════════════════════════════════════════════════════════

-- Consol number (consolidation/manifest number)
ALTER TABLE daily_loads ADD COLUMN IF NOT EXISTS consol_number TEXT;

-- Pickup contact info
ALTER TABLE daily_loads ADD COLUMN IF NOT EXISTS pickup_open_hours TEXT;       -- e.g. "09:00-17:00 Mon-Fri"
ALTER TABLE daily_loads ADD COLUMN IF NOT EXISTS pickup_contact_name TEXT;
ALTER TABLE daily_loads ADD COLUMN IF NOT EXISTS pickup_contact_phone TEXT;

-- Delivery contact info
ALTER TABLE daily_loads ADD COLUMN IF NOT EXISTS delivery_contact_name TEXT;
ALTER TABLE daily_loads ADD COLUMN IF NOT EXISTS delivery_contact_phone TEXT;

-- Package type (PLT, CTN, BOX, OTHER)
ALTER TABLE daily_loads ADD COLUMN IF NOT EXISTS package_type TEXT DEFAULT 'BOX';

-- Weight in kg (in addition to existing weight_lbs)
ALTER TABLE daily_loads ADD COLUMN IF NOT EXISTS weight_kg NUMERIC(8,2);

-- BOL document URL
ALTER TABLE daily_loads ADD COLUMN IF NOT EXISTS bol_url TEXT;
