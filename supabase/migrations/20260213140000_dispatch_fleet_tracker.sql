-- ══════════════════════════════════════════════════════════════
-- DISPATCH & FLEET TRACKING
-- Core operations tables for load tracking, fleet management,
-- wait time analytics, and daily operations summaries.
-- ══════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────
-- 1. Drivers
-- ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS drivers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name       TEXT NOT NULL,
  phone           TEXT,
  email           TEXT,
  hub             TEXT NOT NULL DEFAULT 'phoenix',
  status          TEXT NOT NULL DEFAULT 'active',  -- active, inactive, on_leave
  license_number  TEXT,
  license_expiry  DATE,
  hired_date      DATE,
  hourly_rate     NUMERIC(8,2) DEFAULT 0,
  notes           TEXT,
  created_by      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ──────────────────────────────────────────────────
-- 2. Vehicles
-- ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vehicles (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_name         TEXT NOT NULL,          -- "CV-001"
  vehicle_type         TEXT NOT NULL DEFAULT 'cargo_van',
  make                 TEXT,
  model                TEXT,
  year                 INTEGER,
  vin                  TEXT UNIQUE,
  license_plate        TEXT,
  hub                  TEXT NOT NULL DEFAULT 'phoenix',
  status               TEXT NOT NULL DEFAULT 'active', -- active, maintenance, retired
  current_mileage      INTEGER DEFAULT 0,
  next_service_mileage INTEGER,
  next_service_date    DATE,
  insurance_expiry     DATE,
  registration_expiry  DATE,
  fuel_type            TEXT DEFAULT 'gasoline',
  avg_mpg              NUMERIC(5,2),
  daily_rate           NUMERIC(8,2) DEFAULT 0,
  notes                TEXT,
  created_by           UUID REFERENCES auth.users(id),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ──────────────────────────────────────────────────
-- 3. Daily Loads (replaces the Google Sheet)
-- ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS daily_loads (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  load_date         DATE NOT NULL DEFAULT CURRENT_DATE,
  reference_number  TEXT,
  dispatcher_id     UUID REFERENCES auth.users(id),
  driver_id         UUID REFERENCES drivers(id),
  vehicle_id        UUID REFERENCES vehicles(id),
  shift             TEXT NOT NULL DEFAULT 'day',   -- day, night
  hub               TEXT NOT NULL DEFAULT 'phoenix',

  -- Client & routing
  client_name       TEXT,
  pickup_address    TEXT,
  delivery_address  TEXT,

  -- Miles
  miles             NUMERIC(8,2) DEFAULT 0,
  deadhead_miles    NUMERIC(8,2) DEFAULT 0,

  -- Timing
  start_time        TEXT,      -- "08:30" format
  end_time          TEXT,      -- "09:45" format
  wait_time_minutes INTEGER DEFAULT 0,

  -- Revenue & cost
  revenue           NUMERIC(10,2) DEFAULT 0,
  driver_pay        NUMERIC(10,2) DEFAULT 0,
  fuel_cost         NUMERIC(10,2) DEFAULT 0,

  -- Status
  status            TEXT NOT NULL DEFAULT 'assigned', -- assigned, in_progress, delivered, cancelled, failed

  -- Detention
  detention_eligible BOOLEAN DEFAULT false,
  detention_billed   NUMERIC(10,2) DEFAULT 0,

  -- Details
  service_type      TEXT DEFAULT 'last_mile',
  packages          INTEGER DEFAULT 1,
  weight_lbs        NUMERIC(8,2),
  comments          TEXT,
  pod_confirmed     BOOLEAN DEFAULT false,

  -- Metadata
  created_by        UUID REFERENCES auth.users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ──────────────────────────────────────────────────
-- 4. Vehicle Maintenance
-- ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vehicle_maintenance (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id          UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  maintenance_type    TEXT NOT NULL, -- oil_change, tire_rotation, brake_service, inspection, repair, other
  description         TEXT,
  cost                NUMERIC(10,2) DEFAULT 0,
  mileage_at_service  INTEGER,
  service_date        DATE NOT NULL DEFAULT CURRENT_DATE,
  next_service_date   DATE,
  next_service_mileage INTEGER,
  vendor              TEXT,
  notes               TEXT,
  created_by          UUID REFERENCES auth.users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ──────────────────────────────────────────────────
-- 5. RLS Policies
-- ──────────────────────────────────────────────────
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_loads ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_maintenance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_drivers_select" ON drivers FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_drivers_insert" ON drivers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_drivers_update" ON drivers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_drivers_delete" ON drivers FOR DELETE TO authenticated USING (true);

CREATE POLICY "auth_vehicles_select" ON vehicles FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_vehicles_insert" ON vehicles FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_vehicles_update" ON vehicles FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_vehicles_delete" ON vehicles FOR DELETE TO authenticated USING (true);

CREATE POLICY "auth_daily_loads_select" ON daily_loads FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_daily_loads_insert" ON daily_loads FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_daily_loads_update" ON daily_loads FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_daily_loads_delete" ON daily_loads FOR DELETE TO authenticated USING (true);

CREATE POLICY "auth_vm_select" ON vehicle_maintenance FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_vm_insert" ON vehicle_maintenance FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_vm_update" ON vehicle_maintenance FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_vm_delete" ON vehicle_maintenance FOR DELETE TO authenticated USING (true);

-- ──────────────────────────────────────────────────
-- 6. Indexes
-- ──────────────────────────────────────────────────
CREATE INDEX idx_daily_loads_date ON daily_loads(load_date);
CREATE INDEX idx_daily_loads_driver ON daily_loads(driver_id);
CREATE INDEX idx_daily_loads_status ON daily_loads(status);
CREATE INDEX idx_daily_loads_hub ON daily_loads(hub);
CREATE INDEX idx_vehicle_maintenance_vehicle ON vehicle_maintenance(vehicle_id);
CREATE INDEX idx_vehicles_status ON vehicles(status);
CREATE INDEX idx_drivers_status ON drivers(status);

-- ──────────────────────────────────────────────────
-- 7. Seed Data — Drivers
-- ──────────────────────────────────────────────────
INSERT INTO drivers (full_name, phone, hub, status, hired_date, hourly_rate) VALUES
  ('John Rivera',     '602-555-0101', 'phoenix', 'active', '2024-06-15', 22.00),
  ('Josh Martinez',   '602-555-0102', 'phoenix', 'active', '2024-08-01', 20.00),
  ('Maria Chen',      '213-555-0201', 'la',      'active', '2025-01-10', 24.00),
  ('Carlos Vasquez',  '404-555-0301', 'atlanta', 'active', '2025-03-20', 21.00)
ON CONFLICT DO NOTHING;

-- ──────────────────────────────────────────────────
-- 8. Seed Data — Vehicles
-- ──────────────────────────────────────────────────
INSERT INTO vehicles (vehicle_name, vehicle_type, make, model, year, license_plate, hub, status, current_mileage, avg_mpg, next_service_mileage, next_service_date) VALUES
  ('CV-001', 'cargo_van',  'Ford',     'Transit 250',     2023, 'AZ-CV001', 'phoenix', 'active', 34500, 18.5, 40000, '2026-04-15'),
  ('CV-002', 'cargo_van',  'RAM',      'ProMaster 1500',  2024, 'AZ-CV002', 'phoenix', 'active', 12200, 20.0, 15000, '2026-06-01'),
  ('BT-001', 'box_truck',  'Isuzu',    'NPR HD',          2022, 'AZ-BT001', 'phoenix', 'active', 67800, 12.0, 70000, '2026-03-01'),
  ('SP-001', 'sprinter',   'Mercedes', 'Sprinter 2500',   2024, 'CA-SP001', 'la',      'active',  8900, 22.0, 10000, '2026-07-01'),
  ('CV-003', 'cargo_van',  'Ford',     'Transit 250',     2023, 'GA-CV003', 'atlanta', 'active', 28100, 18.5, 30000, '2026-05-01')
ON CONFLICT DO NOTHING;
