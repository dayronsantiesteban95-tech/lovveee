-- ═══════════════════════════════════════════════════════════
-- Driver GPS Tracking — Real-time location pings
-- Replaces Onfleet/OnTime 360 GPS dependency
-- ═══════════════════════════════════════════════════════════

-- Driver location pings (GPS breadcrumb trail)
CREATE TABLE IF NOT EXISTS driver_locations (
    id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    driver_id   uuid NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
    latitude    double precision NOT NULL,
    longitude   double precision NOT NULL,
    accuracy    double precision,          -- GPS accuracy in meters
    speed       double precision,          -- m/s from Geolocation API
    heading     double precision,          -- degrees from north
    altitude    double precision,
    battery_pct smallint,                  -- driver phone battery %
    is_moving   boolean DEFAULT false,
    active_load_id uuid REFERENCES daily_loads(id) ON DELETE SET NULL,
    recorded_at timestamptz DEFAULT now() NOT NULL,
    created_at  timestamptz DEFAULT now() NOT NULL
);

-- Index for real-time queries: latest position per driver
CREATE INDEX idx_driver_locations_driver_latest
    ON driver_locations (driver_id, recorded_at DESC);

-- Index for date-range history queries
CREATE INDEX idx_driver_locations_recorded
    ON driver_locations (recorded_at);

-- ─── Driver shift / duty status ───────────────────────
-- Track when drivers are on-duty (broadcasting GPS)
CREATE TABLE IF NOT EXISTS driver_shifts (
    id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    driver_id   uuid NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
    shift_start timestamptz DEFAULT now() NOT NULL,
    shift_end   timestamptz,
    hub         text NOT NULL DEFAULT 'phoenix',
    status      text NOT NULL DEFAULT 'on_duty'
                CHECK (status IN ('on_duty', 'break', 'off_duty')),
    start_lat   double precision,
    start_lng   double precision,
    end_lat     double precision,
    end_lng     double precision,
    total_miles double precision DEFAULT 0,
    created_at  timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_driver_shifts_active
    ON driver_shifts (driver_id, shift_end)
    WHERE shift_end IS NULL;

-- ─── Load status events (auto-audit trail) ────────────
-- Every status change from driver gets logged
CREATE TABLE IF NOT EXISTS load_status_events (
    id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    load_id     uuid NOT NULL REFERENCES daily_loads(id) ON DELETE CASCADE,
    driver_id   uuid NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
    old_status  text,
    new_status  text NOT NULL,
    latitude    double precision,
    longitude   double precision,
    note        text,
    recorded_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_load_events_load
    ON load_status_events (load_id, recorded_at DESC);

-- ─── RLS Policies ─────────────────────────────────────
ALTER TABLE driver_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE load_status_events ENABLE ROW LEVEL SECURITY;

-- Drivers can insert their own GPS pings
CREATE POLICY driver_locations_insert ON driver_locations
    FOR INSERT TO authenticated
    WITH CHECK (
        driver_id IN (
            SELECT id FROM drivers WHERE user_id = auth.uid()
        )
    );

-- Dispatchers can read all GPS data
CREATE POLICY driver_locations_select ON driver_locations
    FOR SELECT TO authenticated
    USING (true);

-- Driver shifts: drivers manage their own, dispatchers read all
CREATE POLICY driver_shifts_insert ON driver_shifts
    FOR INSERT TO authenticated
    WITH CHECK (
        driver_id IN (
            SELECT id FROM drivers WHERE user_id = auth.uid()
        )
    );

CREATE POLICY driver_shifts_update ON driver_shifts
    FOR UPDATE TO authenticated
    USING (
        driver_id IN (
            SELECT id FROM drivers WHERE user_id = auth.uid()
        )
    );

CREATE POLICY driver_shifts_select ON driver_shifts
    FOR SELECT TO authenticated
    USING (true);

-- Load events: drivers insert, everyone reads
CREATE POLICY load_events_insert ON load_status_events
    FOR INSERT TO authenticated
    WITH CHECK (
        driver_id IN (
            SELECT id FROM drivers WHERE user_id = auth.uid()
        )
    );

CREATE POLICY load_events_select ON load_status_events
    FOR SELECT TO authenticated
    USING (true);

-- ─── Realtime: enable broadcasts for live GPS ─────────
ALTER PUBLICATION supabase_realtime ADD TABLE driver_locations;
ALTER PUBLICATION supabase_realtime ADD TABLE driver_shifts;
ALTER PUBLICATION supabase_realtime ADD TABLE load_status_events;

-- ─── Function: Get latest position per driver ─────────
CREATE OR REPLACE FUNCTION get_driver_positions()
RETURNS TABLE (
    driver_id uuid,
    driver_name text,
    hub text,
    latitude double precision,
    longitude double precision,
    speed double precision,
    heading double precision,
    battery_pct smallint,
    is_moving boolean,
    active_load_id uuid,
    recorded_at timestamptz,
    shift_status text
) LANGUAGE sql STABLE AS $$
    SELECT DISTINCT ON (dl.driver_id)
        dl.driver_id,
        d.full_name AS driver_name,
        d.hub,
        dl.latitude,
        dl.longitude,
        dl.speed,
        dl.heading,
        dl.battery_pct,
        dl.is_moving,
        dl.active_load_id,
        dl.recorded_at,
        COALESCE(ds.status, 'off_duty') AS shift_status
    FROM driver_locations dl
    JOIN drivers d ON d.id = dl.driver_id
    LEFT JOIN driver_shifts ds ON ds.driver_id = dl.driver_id AND ds.shift_end IS NULL
    WHERE dl.recorded_at > now() - interval '10 minutes'
    ORDER BY dl.driver_id, dl.recorded_at DESC;
$$;
