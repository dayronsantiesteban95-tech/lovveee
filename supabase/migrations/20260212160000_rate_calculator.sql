-- ══════════════════════════════════════════════════
-- Rate Calculator: rate_cards + saved_quotes
-- ══════════════════════════════════════════════════

-- Rate cards: configurable pricing matrix
CREATE TABLE IF NOT EXISTS rate_cards (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  hub TEXT NOT NULL,
  service_type TEXT NOT NULL,
  vehicle_type TEXT NOT NULL,
  base_rate NUMERIC NOT NULL DEFAULT 0,
  per_mile_rate NUMERIC NOT NULL DEFAULT 0,
  per_lb_rate NUMERIC NOT NULL DEFAULT 0,
  min_charge NUMERIC NOT NULL DEFAULT 0,
  fuel_surcharge_pct NUMERIC NOT NULL DEFAULT 15,
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(hub, service_type, vehicle_type)
);

-- Saved quotes: history of generated quotes
CREATE TABLE IF NOT EXISTS saved_quotes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  hub TEXT NOT NULL,
  service_type TEXT NOT NULL,
  vehicle_type TEXT NOT NULL,
  distance_miles NUMERIC NOT NULL DEFAULT 0,
  weight_lbs NUMERIC NOT NULL DEFAULT 0,
  stops INTEGER NOT NULL DEFAULT 1,
  base_rate NUMERIC NOT NULL DEFAULT 0,
  mileage_charge NUMERIC NOT NULL DEFAULT 0,
  weight_charge NUMERIC NOT NULL DEFAULT 0,
  fuel_surcharge NUMERIC NOT NULL DEFAULT 0,
  stop_fee NUMERIC NOT NULL DEFAULT 0,
  total_quote NUMERIC NOT NULL DEFAULT 0,
  margin_pct NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS policies
ALTER TABLE rate_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_quotes ENABLE ROW LEVEL SECURITY;

-- Everyone can read rate cards
CREATE POLICY "rate_cards_select" ON rate_cards FOR SELECT USING (true);
-- Only authenticated users can manage rate cards (owner check done in UI)
CREATE POLICY "rate_cards_insert" ON rate_cards FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "rate_cards_update" ON rate_cards FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "rate_cards_delete" ON rate_cards FOR DELETE USING (auth.uid() IS NOT NULL);

-- Everyone can read/write their own quotes
CREATE POLICY "saved_quotes_select" ON saved_quotes FOR SELECT USING (true);
CREATE POLICY "saved_quotes_insert" ON saved_quotes FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "saved_quotes_delete" ON saved_quotes FOR DELETE USING (auth.uid() = created_by);

-- ══════════════════════════════════════════════════
-- Seed default rate cards (3 hubs × 4 services × 4 vehicles = 48 rows)
-- ══════════════════════════════════════════════════

-- Atlanta rates
INSERT INTO rate_cards (hub, service_type, vehicle_type, base_rate, per_mile_rate, per_lb_rate, min_charge, fuel_surcharge_pct) VALUES
  ('atlanta', 'last_mile',   'cargo_van',  35, 1.50, 0.05, 45,  15),
  ('atlanta', 'last_mile',   'sprinter',   45, 1.75, 0.06, 55,  15),
  ('atlanta', 'last_mile',   'box_truck',  55, 2.00, 0.07, 70,  15),
  ('atlanta', 'last_mile',   'car_suv',    25, 1.25, 0.03, 35,  15),
  ('atlanta', 'courier',     'cargo_van',  30, 1.40, 0.04, 40,  15),
  ('atlanta', 'courier',     'sprinter',   40, 1.60, 0.05, 50,  15),
  ('atlanta', 'courier',     'box_truck',  50, 1.85, 0.06, 65,  15),
  ('atlanta', 'courier',     'car_suv',    25, 1.25, 0.03, 35,  15),
  ('atlanta', 'white_glove', 'cargo_van',  65, 2.25, 0.08, 85,  15),
  ('atlanta', 'white_glove', 'sprinter',   75, 2.50, 0.10, 100, 15),
  ('atlanta', 'white_glove', 'box_truck',  90, 2.75, 0.12, 120, 15),
  ('atlanta', 'white_glove', 'car_suv',    55, 2.00, 0.07, 75,  15),
  ('atlanta', 'hotshot',     'cargo_van',  80, 2.75, 0.07, 100, 18),
  ('atlanta', 'hotshot',     'sprinter',   95, 3.00, 0.08, 125, 18),
  ('atlanta', 'hotshot',     'box_truck',  110, 3.25, 0.10, 145, 18),
  ('atlanta', 'hotshot',     'car_suv',    70, 2.50, 0.06, 90,  18)
ON CONFLICT (hub, service_type, vehicle_type) DO NOTHING;

-- Phoenix rates (slightly lower COL)
INSERT INTO rate_cards (hub, service_type, vehicle_type, base_rate, per_mile_rate, per_lb_rate, min_charge, fuel_surcharge_pct) VALUES
  ('phoenix', 'last_mile',   'cargo_van',  30, 1.40, 0.04, 40,  15),
  ('phoenix', 'last_mile',   'sprinter',   40, 1.65, 0.05, 50,  15),
  ('phoenix', 'last_mile',   'box_truck',  50, 1.90, 0.06, 65,  15),
  ('phoenix', 'last_mile',   'car_suv',    22, 1.15, 0.03, 30,  15),
  ('phoenix', 'courier',     'cargo_van',  28, 1.30, 0.04, 38,  15),
  ('phoenix', 'courier',     'sprinter',   38, 1.50, 0.05, 48,  15),
  ('phoenix', 'courier',     'box_truck',  48, 1.75, 0.06, 60,  15),
  ('phoenix', 'courier',     'car_suv',    22, 1.15, 0.03, 30,  15),
  ('phoenix', 'white_glove', 'cargo_van',  60, 2.15, 0.07, 80,  15),
  ('phoenix', 'white_glove', 'sprinter',   70, 2.40, 0.09, 95,  15),
  ('phoenix', 'white_glove', 'box_truck',  85, 2.65, 0.11, 115, 15),
  ('phoenix', 'white_glove', 'car_suv',    50, 1.90, 0.06, 70,  15),
  ('phoenix', 'hotshot',     'cargo_van',  75, 2.60, 0.06, 95,  18),
  ('phoenix', 'hotshot',     'sprinter',   90, 2.85, 0.08, 120, 18),
  ('phoenix', 'hotshot',     'box_truck',  105, 3.10, 0.09, 140, 18),
  ('phoenix', 'hotshot',     'car_suv',    65, 2.35, 0.05, 85,  18)
ON CONFLICT (hub, service_type, vehicle_type) DO NOTHING;

-- Los Angeles rates (higher COL)
INSERT INTO rate_cards (hub, service_type, vehicle_type, base_rate, per_mile_rate, per_lb_rate, min_charge, fuel_surcharge_pct) VALUES
  ('la', 'last_mile',   'cargo_van',  40, 1.65, 0.06, 50,  16),
  ('la', 'last_mile',   'sprinter',   50, 1.90, 0.07, 65,  16),
  ('la', 'last_mile',   'box_truck',  60, 2.15, 0.08, 80,  16),
  ('la', 'last_mile',   'car_suv',    30, 1.35, 0.04, 40,  16),
  ('la', 'courier',     'cargo_van',  35, 1.50, 0.05, 45,  16),
  ('la', 'courier',     'sprinter',   45, 1.70, 0.06, 55,  16),
  ('la', 'courier',     'box_truck',  55, 2.00, 0.07, 70,  16),
  ('la', 'courier',     'car_suv',    28, 1.35, 0.04, 38,  16),
  ('la', 'white_glove', 'cargo_van',  70, 2.40, 0.09, 90,  16),
  ('la', 'white_glove', 'sprinter',   80, 2.65, 0.11, 105, 16),
  ('la', 'white_glove', 'box_truck',  95, 2.90, 0.13, 130, 16),
  ('la', 'white_glove', 'car_suv',    60, 2.15, 0.08, 80,  16),
  ('la', 'hotshot',     'cargo_van',  85, 2.90, 0.08, 110, 20),
  ('la', 'hotshot',     'sprinter',   100, 3.15, 0.09, 135, 20),
  ('la', 'hotshot',     'box_truck',  120, 3.50, 0.11, 155, 20),
  ('la', 'hotshot',     'car_suv',    75, 2.65, 0.07, 95,  20)
ON CONFLICT (hub, service_type, vehicle_type) DO NOTHING;
