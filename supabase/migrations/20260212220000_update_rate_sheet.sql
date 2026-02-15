-- ══════════════════════════════════════════════════════════════
-- ANIKA PHX & LAX LOCAL RATE SHEET — EXACT rates from document
-- Effective: 01/26 – 12/26
-- "Rates apply equally to PHX and LAX local operations"
--
-- THIS MIGRATION USES UPSERT — safe to run multiple times
-- ══════════════════════════════════════════════════════════════

-- Step 1: Add new columns if they don't exist
ALTER TABLE rate_cards ADD COLUMN IF NOT EXISTS included_miles INTEGER NOT NULL DEFAULT 0;
ALTER TABLE rate_cards ADD COLUMN IF NOT EXISTS weight_threshold_lbs INTEGER NOT NULL DEFAULT 0;

-- ──────────────────────────────────────────────────
-- Step 2: UPSERT the correct PHX & LAX rates
-- These are the ONLY official rates from the Anika rate sheet.
-- Using INSERT ... ON CONFLICT DO UPDATE to ensure correct values
-- regardless of what was previously in the database.
-- ──────────────────────────────────────────────────

-- ▸ PHOENIX — Cargo Van
--   Base Rate: $105.00 (first 20 miles – pickup to destination)
--   Additional Miles: $2.00 / mile (after first 20 miles)
--   Deadhead Miles: $2.00 / mile (base to pickup only)  ← uses same per_mile_rate
--   Fuel Surcharge: 25%
--   Weight: $0.10 per lb over 100 lbs
INSERT INTO rate_cards (hub, service_type, vehicle_type, base_rate, per_mile_rate, per_lb_rate, min_charge, fuel_surcharge_pct, included_miles, weight_threshold_lbs)
VALUES ('phoenix', 'last_mile', 'cargo_van', 105, 2.00, 0.10, 105, 25, 20, 100)
ON CONFLICT (hub, service_type, vehicle_type) DO UPDATE SET
  base_rate = 105,
  per_mile_rate = 2.00,
  per_lb_rate = 0.10,
  min_charge = 105,
  fuel_surcharge_pct = 25,
  included_miles = 20,
  weight_threshold_lbs = 100,
  updated_at = now();

-- ▸ PHOENIX — Box Truck
--   Base Rate: $170.00 (first 20 miles – pickup to destination)
--   Additional Miles: $2.50 / mile (after first 20 miles)
--   Deadhead Miles: $2.50 / mile (base to pickup only)  ← uses same per_mile_rate
--   Fuel Surcharge: 25%
--   Weight: $0.15 per lb over 600 lbs
INSERT INTO rate_cards (hub, service_type, vehicle_type, base_rate, per_mile_rate, per_lb_rate, min_charge, fuel_surcharge_pct, included_miles, weight_threshold_lbs)
VALUES ('phoenix', 'last_mile', 'box_truck', 170, 2.50, 0.15, 170, 25, 20, 600)
ON CONFLICT (hub, service_type, vehicle_type) DO UPDATE SET
  base_rate = 170,
  per_mile_rate = 2.50,
  per_lb_rate = 0.15,
  min_charge = 170,
  fuel_surcharge_pct = 25,
  included_miles = 20,
  weight_threshold_lbs = 600,
  updated_at = now();

-- ▸ LOS ANGELES — Cargo Van (SAME rates as PHX per rate sheet)
INSERT INTO rate_cards (hub, service_type, vehicle_type, base_rate, per_mile_rate, per_lb_rate, min_charge, fuel_surcharge_pct, included_miles, weight_threshold_lbs)
VALUES ('la', 'last_mile', 'cargo_van', 105, 2.00, 0.10, 105, 25, 20, 100)
ON CONFLICT (hub, service_type, vehicle_type) DO UPDATE SET
  base_rate = 105,
  per_mile_rate = 2.00,
  per_lb_rate = 0.10,
  min_charge = 105,
  fuel_surcharge_pct = 25,
  included_miles = 20,
  weight_threshold_lbs = 100,
  updated_at = now();

-- ▸ LOS ANGELES — Box Truck (SAME rates as PHX per rate sheet)
INSERT INTO rate_cards (hub, service_type, vehicle_type, base_rate, per_mile_rate, per_lb_rate, min_charge, fuel_surcharge_pct, included_miles, weight_threshold_lbs)
VALUES ('la', 'last_mile', 'box_truck', 170, 2.50, 0.15, 170, 25, 20, 600)
ON CONFLICT (hub, service_type, vehicle_type) DO UPDATE SET
  base_rate = 170,
  per_mile_rate = 2.50,
  per_lb_rate = 0.15,
  min_charge = 170,
  fuel_surcharge_pct = 25,
  included_miles = 20,
  weight_threshold_lbs = 600,
  updated_at = now();

-- ──────────────────────────────────────────────────
-- Step 3: Atlanta — preserve existing rates, just add new columns
-- (Update when ATL rate sheet is available)
-- ──────────────────────────────────────────────────
UPDATE rate_cards SET included_miles = 20, weight_threshold_lbs = 100
  WHERE hub = 'atlanta' AND vehicle_type IN ('cargo_van', 'car_suv');
UPDATE rate_cards SET included_miles = 20, weight_threshold_lbs = 300
  WHERE hub = 'atlanta' AND vehicle_type = 'sprinter';
UPDATE rate_cards SET included_miles = 20, weight_threshold_lbs = 600
  WHERE hub = 'atlanta' AND vehicle_type = 'box_truck';

-- ══════════════════════════════════════════════════════════════
-- VERIFICATION SUMMARY (from rate sheet document):
--
-- BASE TRANSPORTATION RATES:
-- ┌──────────────────────────────────────┬────────────┬────────────┐
-- │ Service Description                  │ Cargo Van  │ Box Truck  │
-- ├──────────────────────────────────────┼────────────┼────────────┤
-- │ Base Rate (first 20 mi)              │ $105.00    │ $170.00    │
-- │ Additional Miles (after 20)          │ $2.00/mi   │ $2.50/mi   │
-- │ Deadhead Miles (base to pickup)      │ $2.00/mi   │ $2.50/mi   │
-- │ Fuel Surcharge                       │ 25%        │ 25%        │
-- ├──────────────────────────────────────┼────────────┼────────────┤
-- │ Weight                               │ $0.10/lb   │ $0.15/lb   │
-- │                                      │ over 100   │ over 600   │
-- └──────────────────────────────────────┴────────────┴────────────┘
--
-- TIME & ACCESS CHARGES (same for both vehicles):
--   After Hours (20:00-07:59)    $25.00
--   Weekend (Sat & Sun)          $25.00
--   Holiday                      $50.00
--   Tendering Fee (airport)      $15.00
--   Attempt Charge               Base Rate
--
-- ACCESSORIAL & SPECIAL SERVICES (same for both vehicles):
--   Additional Stop              $50.00
--   Extra Piece (per piece)      $15.00
--   Special Handling              $20.00
--   Documents                     $20.00
--   Holding (per day, per unit)   $50.00
--   Wait Time (per 15 min)        $30.00  (first 15 free)
--   2nd Person Ride-Along         $100.00
--   White Glove Service           $50.00
--   Dangerous Goods / Hazmat      $50.00
-- ══════════════════════════════════════════════════════════════
