-- ══════════════════════════════════════════════════════════════
-- COMPETITIVE QUOTING — Market Rate Intelligence
-- Tracks competitor rates for comparison during quoting.
-- ══════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────
-- 1. Competitor Rates Table
--    Stores per-competitor pricing across hubs, vehicles, and
--    distance tiers so we can compare in real time.
-- ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS competitor_rates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_name TEXT NOT NULL,           -- e.g. 'FedEx Custom Critical', 'GoShare', 'Frayt'
  hub             TEXT NOT NULL,           -- 'phoenix', 'la', 'atlanta'
  vehicle_type    TEXT NOT NULL,           -- 'cargo_van', 'box_truck'
  service_type    TEXT NOT NULL DEFAULT 'last_mile',

  -- Pricing structure (mirrors our rate_cards for 1:1 comparison)
  base_rate           NUMERIC(10,2) NOT NULL DEFAULT 0,
  per_mile_rate       NUMERIC(10,2) NOT NULL DEFAULT 0,
  fuel_surcharge_pct  NUMERIC(5,2)  NOT NULL DEFAULT 0,
  included_miles      INTEGER       NOT NULL DEFAULT 0,
  min_charge          NUMERIC(10,2) NOT NULL DEFAULT 0,

  -- Source & freshness tracking
  source          TEXT NOT NULL DEFAULT 'manual',  -- 'manual', 'website', 'broker_post', 'customer_intel'
  source_url      TEXT,                            -- URL if scraped from website
  confidence      TEXT NOT NULL DEFAULT 'medium',  -- 'high', 'medium', 'low'
  notes           TEXT,
  effective_date  DATE NOT NULL DEFAULT CURRENT_DATE,
  expiration_date DATE,

  -- Metadata
  created_by      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- One rate per competitor+hub+vehicle+service combo
  UNIQUE(competitor_name, hub, vehicle_type, service_type)
);

-- Enable RLS
ALTER TABLE competitor_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read competitor_rates"
  ON competitor_rates FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert competitor_rates"
  ON competitor_rates FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update competitor_rates"
  ON competitor_rates FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete competitor_rates"
  ON competitor_rates FOR DELETE
  TO authenticated USING (true);

-- ──────────────────────────────────────────────────
-- 2. Add competitor tracking fields to leads table
--    Track which competitor we're up against per deal
-- ──────────────────────────────────────────────────
ALTER TABLE leads ADD COLUMN IF NOT EXISTS competitor_name TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS competitor_rate NUMERIC(10,2);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS win_loss_reason TEXT;

-- ──────────────────────────────────────────────────
-- 3. Seed initial competitor data
--    Based on publicly available last-mile rates for PHX & LAX markets
--    Sources: competitor websites, industry benchmarks, broker posts
-- ──────────────────────────────────────────────────

-- ▸ GoShare (on-demand last-mile)
INSERT INTO competitor_rates (competitor_name, hub, vehicle_type, base_rate, per_mile_rate, fuel_surcharge_pct, included_miles, min_charge, source, confidence, notes) VALUES
  ('GoShare',  'phoenix', 'cargo_van', 75,  1.50, 0,  0, 75,  'website', 'medium', 'GoShare on-demand cargo van. No fuel surcharge shown. All-in rate.'),
  ('GoShare',  'phoenix', 'box_truck', 130, 2.00, 0,  0, 130, 'website', 'medium', 'GoShare box truck rate. No fuel surcharge shown.'),
  ('GoShare',  'la',      'cargo_van', 85,  1.65, 0,  0, 85,  'website', 'medium', 'LA market slightly higher than PHX.'),
  ('GoShare',  'la',      'box_truck', 140, 2.10, 0,  0, 140, 'website', 'medium', 'GoShare LA box truck.'),
  ('GoShare',  'atlanta', 'cargo_van', 70,  1.45, 0,  0, 70,  'website', 'low',    'Atlanta estimated from national avg.'),
  ('GoShare',  'atlanta', 'box_truck', 125, 1.90, 0,  0, 125, 'website', 'low',    'Atlanta estimated.');

-- ▸ Frayt
INSERT INTO competitor_rates (competitor_name, hub, vehicle_type, base_rate, per_mile_rate, fuel_surcharge_pct, included_miles, min_charge, source, confidence, notes) VALUES
  ('Frayt',    'phoenix', 'cargo_van', 90,  1.75, 15, 10, 90,  'website', 'medium', 'Frayt dash pricing. 15% FSC. 10 mi included.'),
  ('Frayt',    'phoenix', 'box_truck', 155, 2.25, 15, 10, 155, 'website', 'medium', 'Frayt box truck last-mile.'),
  ('Frayt',    'la',      'cargo_van', 95,  1.85, 15, 10, 95,  'website', 'medium', 'Frayt LA cargo van.'),
  ('Frayt',    'la',      'box_truck', 165, 2.35, 15, 10, 165, 'website', 'medium', 'Frayt LA box truck.'),
  ('Frayt',    'atlanta', 'cargo_van', 85,  1.70, 15, 10, 85,  'website', 'low',    'Frayt ATL estimated.'),
  ('Frayt',    'atlanta', 'box_truck', 145, 2.15, 15, 10, 145, 'website', 'low',    'Frayt ATL estimated.');

-- ▸ Dolly (mainly white-glove, but competes in last-mile)
INSERT INTO competitor_rates (competitor_name, hub, vehicle_type, base_rate, per_mile_rate, fuel_surcharge_pct, included_miles, min_charge, source, confidence, notes) VALUES
  ('Dolly',    'phoenix', 'cargo_van', 80,  1.60, 0,  5,  80,  'website', 'medium', 'Dolly on-demand. 5 mi included. No FSC.'),
  ('Dolly',    'phoenix', 'box_truck', 140, 2.10, 0,  5,  140, 'website', 'medium', 'Dolly box truck.'),
  ('Dolly',    'la',      'cargo_van', 90,  1.75, 0,  5,  90,  'website', 'medium', 'Dolly LA cargo van.'),
  ('Dolly',    'la',      'box_truck', 150, 2.25, 0,  5,  150, 'website', 'medium', 'Dolly LA box truck.');

-- ▸ FedEx Custom Critical (premium competitor)
INSERT INTO competitor_rates (competitor_name, hub, vehicle_type, base_rate, per_mile_rate, fuel_surcharge_pct, included_miles, min_charge, source, confidence, notes) VALUES
  ('FedEx Custom Critical', 'phoenix', 'cargo_van', 150, 2.50, 18, 0, 150, 'customer_intel', 'high', 'FedEx CCC. Premium pricing. No included miles.'),
  ('FedEx Custom Critical', 'phoenix', 'box_truck', 250, 3.25, 18, 0, 250, 'customer_intel', 'high', 'FedEx CCC box truck. Very premium.'),
  ('FedEx Custom Critical', 'la',      'cargo_van', 160, 2.65, 18, 0, 160, 'customer_intel', 'high', 'FedEx CCC LA cargo van.'),
  ('FedEx Custom Critical', 'la',      'box_truck', 265, 3.40, 18, 0, 265, 'customer_intel', 'high', 'FedEx CCC LA box truck.');

-- ▸ OnTrac (regional competitor in PHX/LA)
INSERT INTO competitor_rates (competitor_name, hub, vehicle_type, base_rate, per_mile_rate, fuel_surcharge_pct, included_miles, min_charge, source, confidence, notes) VALUES
  ('OnTrac',   'phoenix', 'cargo_van', 65,  1.35, 20, 15, 65,  'broker_post', 'medium', 'OnTrac parcel/last-mile. Lower base but FSC.'),
  ('OnTrac',   'la',      'cargo_van', 70,  1.40, 20, 15, 70,  'broker_post', 'medium', 'OnTrac LA. Lower base but 20% FSC.');

-- ▸ Local Courier (generic local competitor baseline)
INSERT INTO competitor_rates (competitor_name, hub, vehicle_type, base_rate, per_mile_rate, fuel_surcharge_pct, included_miles, min_charge, source, confidence, notes) VALUES
  ('Local Courier Avg', 'phoenix', 'cargo_van', 85,  1.75, 10, 10, 85,  'manual', 'low', 'Average of 3 local courier companies in PHX.'),
  ('Local Courier Avg', 'phoenix', 'box_truck', 145, 2.20, 10, 10, 145, 'manual', 'low', 'Average of local box truck couriers in PHX.'),
  ('Local Courier Avg', 'la',      'cargo_van', 95,  1.85, 10, 10, 95,  'manual', 'low', 'Average LA local couriers.'),
  ('Local Courier Avg', 'la',      'box_truck', 155, 2.35, 10, 10, 155, 'manual', 'low', 'Average LA local box truck.'),
  ('Local Courier Avg', 'atlanta', 'cargo_van', 80,  1.65, 10, 10, 80,  'manual', 'low', 'Average ATL local couriers.'),
  ('Local Courier Avg', 'atlanta', 'box_truck', 135, 2.10, 10, 10, 135, 'manual', 'low', 'Average ATL local box truck.');
