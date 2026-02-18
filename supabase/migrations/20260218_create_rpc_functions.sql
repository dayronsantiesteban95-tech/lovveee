-- ═══════════════════════════════════════════════════════════
-- Migration: RPC Functions + Pod Submissions Table
-- Anika Control OS — Phase 7 Prep
-- Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════

-- ────────────────────────────────────────────────
-- 1. POD Submissions table (for driver app)
-- ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pod_submissions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    load_id         UUID NOT NULL REFERENCES daily_loads(id) ON DELETE CASCADE,
    driver_id       UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
    photo_url       TEXT,
    signature_url   TEXT,
    notes           TEXT,
    lat             DECIMAL(10, 7),
    lng             DECIMAL(10, 7),
    captured_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pod_load ON pod_submissions(load_id);
CREATE INDEX IF NOT EXISTS idx_pod_driver ON pod_submissions(driver_id);

ALTER TABLE pod_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Drivers can insert their own PODs"
    ON pod_submissions FOR INSERT
    TO authenticated
    WITH CHECK (
        driver_id IN (
            SELECT id FROM drivers WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Authenticated users can view all PODs"
    ON pod_submissions FOR SELECT
    TO authenticated
    USING (true);

-- ────────────────────────────────────────────────
-- 2. RPC: get_driver_by_user
--    Returns the driver record for the current auth user
-- ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_driver_by_user(p_user_id UUID)
RETURNS SETOF drivers
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT * FROM drivers
    WHERE user_id = p_user_id
    LIMIT 1;
$$;

-- ────────────────────────────────────────────────
-- 3. RPC: get_driver_loads_today
--    Returns today's loads for a driver
-- ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_driver_loads_today(p_driver_id UUID)
RETURNS SETOF daily_loads
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT * FROM daily_loads
    WHERE driver_id = p_driver_id
      AND load_date = CURRENT_DATE
    ORDER BY created_at DESC;
$$;

-- ────────────────────────────────────────────────
-- 4. RPC: update_load_status
--    Atomically update load status + log event
-- ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_load_status(
    p_load_id   UUID,
    p_driver_id UUID,
    p_status    TEXT,
    p_lat       DECIMAL DEFAULT NULL,
    p_lng       DECIMAL DEFAULT NULL,
    p_notes     TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_now TIMESTAMPTZ := now();
    v_updates JSONB := jsonb_build_object('status', p_status, 'updated_at', v_now);
BEGIN
    -- Validate status
    IF p_status NOT IN ('pending','assigned','blasted','in_progress','delivered','cancelled','failed') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid status: ' || p_status);
    END IF;

    -- Set timestamp fields
    IF p_status = 'in_progress' THEN
        v_updates := v_updates || jsonb_build_object('actual_pickup', v_now);
    END IF;
    IF p_status = 'delivered' THEN
        v_updates := v_updates || jsonb_build_object('actual_delivery', v_now);
    END IF;

    -- Update load
    UPDATE daily_loads
    SET
        status = p_status,
        actual_pickup = CASE WHEN p_status = 'in_progress' THEN v_now ELSE actual_pickup END,
        actual_delivery = CASE WHEN p_status = 'delivered' THEN v_now ELSE actual_delivery END,
        updated_at = v_now
    WHERE id = p_load_id;

    -- Log event
    INSERT INTO load_status_events (load_id, driver_id, status, lat, lng, notes, created_at)
    VALUES (p_load_id, p_driver_id, p_status, p_lat, p_lng, p_notes, v_now);

    RETURN jsonb_build_object('success', true, 'load_id', p_load_id, 'status', p_status);
END;
$$;

-- ────────────────────────────────────────────────
-- 5. RPC: get_active_blasts_for_driver
--    Returns pending blasts sent to this driver
-- ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_active_blasts_for_driver(p_driver_id UUID)
RETURNS TABLE (
    blast_id        UUID,
    load_id         UUID,
    message         TEXT,
    blast_status    TEXT,
    expires_at      TIMESTAMPTZ,
    blast_created   TIMESTAMPTZ,
    response_status TEXT,
    -- Load fields
    reference_number TEXT,
    client_name      TEXT,
    pickup_address   TEXT,
    delivery_address TEXT,
    pickup_company   TEXT,
    delivery_company TEXT,
    miles            NUMERIC,
    revenue          NUMERIC,
    packages         INTEGER,
    service_type     TEXT,
    delivery_time    TIMESTAMPTZ,
    description      TEXT
)
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT
        db.id               AS blast_id,
        db.load_id,
        db.message,
        db.status           AS blast_status,
        db.expires_at,
        db.created_at       AS blast_created,
        br.status           AS response_status,
        dl.reference_number,
        dl.client_name,
        dl.pickup_address,
        dl.delivery_address,
        dl.pickup_company,
        dl.delivery_company,
        dl.miles,
        dl.revenue,
        dl.packages,
        dl.service_type,
        dl.delivery_time,
        dl.description
    FROM blast_responses br
    JOIN dispatch_blasts db ON db.id = br.blast_id
    JOIN daily_loads dl     ON dl.id = db.load_id
    WHERE br.driver_id      = p_driver_id
      AND br.status         = 'pending'
      AND db.status         = 'active'
      AND db.expires_at     > now()
    ORDER BY db.created_at DESC;
$$;

-- ────────────────────────────────────────────────
-- 6. RPC: upsert_driver_location
--    GPS ping from driver app
-- ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION upsert_driver_location(
    p_driver_id UUID,
    p_lat       DECIMAL,
    p_lng       DECIMAL,
    p_heading   DECIMAL DEFAULT NULL,
    p_speed     DECIMAL DEFAULT NULL,
    p_accuracy  DECIMAL DEFAULT NULL
)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
AS $$
    INSERT INTO driver_locations (driver_id, lat, lng, heading, speed, accuracy, updated_at)
    VALUES (p_driver_id, p_lat, p_lng, p_heading, p_speed, p_accuracy, now())
    ON CONFLICT (driver_id)
    DO UPDATE SET
        lat        = EXCLUDED.lat,
        lng        = EXCLUDED.lng,
        heading    = EXCLUDED.heading,
        speed      = EXCLUDED.speed,
        accuracy   = EXCLUDED.accuracy,
        updated_at = now();
$$;

-- ────────────────────────────────────────────────
-- Verification
-- ────────────────────────────────────────────────
-- After running, verify with:
--   SELECT routine_name FROM information_schema.routines
--   WHERE routine_schema = 'public' AND routine_type = 'FUNCTION';
--
-- Expected: get_driver_by_user, get_driver_loads_today,
--           update_load_status, get_active_blasts_for_driver,
--           upsert_driver_location
--
-- Also check: SELECT * FROM information_schema.tables
--             WHERE table_name = 'pod_submissions';
