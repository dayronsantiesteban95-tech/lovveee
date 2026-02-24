-- ----------------------------------------------------------------
-- Fix 1: load_status_events column names in RPC + RLS
-- Fix 2: Tracking token generator increased to 8 chars
-- ----------------------------------------------------------------

-- ================================================================
-- 1. Add latitude/longitude columns to load_status_events
--    (useful for geofence audit trail)
-- ================================================================
ALTER TABLE load_status_events
    ADD COLUMN IF NOT EXISTS latitude double precision,
    ADD COLUMN IF NOT EXISTS longitude double precision;

-- ================================================================
-- 2. Fix RLS policy on load_status_events
--    Old policy referenced "driver_id" column which no longer exists
--    (actual column is "changed_by"). Allow any authenticated user
--    to insert since dispatchers also log events. The RPC handles
--    driver-side inserts with SECURITY DEFINER.
-- ================================================================
DROP POLICY IF EXISTS load_events_insert ON load_status_events;

CREATE POLICY load_events_insert ON load_status_events
    FOR INSERT TO authenticated
    WITH CHECK (true);

-- ================================================================
-- 3. Fix update_load_status RPC to use correct column names
--    Old: (driver_id, status, lat, lng, notes, created_at) -- WRONG
--    New: (changed_by, previous_status, new_status, reason, latitude, longitude, created_at)
-- ================================================================
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
    v_load RECORD;
    v_current_status TEXT;
    v_target_lat DECIMAL;
    v_target_lng DECIMAL;
    v_distance DECIMAL;
    v_geofence_radius DECIMAL := 200; -- meters
BEGIN
    -- Validate status
    IF p_status NOT IN (
        'pending','assigned','blasted','in_progress',
        'arrived_pickup','in_transit','arrived_delivery',
        'delivered','completed','cancelled','failed'
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid status: ' || p_status);
    END IF;

    -- Load the current load record for geofence check + old status
    SELECT status, pickup_lat, pickup_lng, delivery_lat, delivery_lng
    INTO v_current_status, v_target_lat, v_target_lng,
         v_load.delivery_lat, v_load.delivery_lng
    FROM daily_loads
    WHERE id = p_load_id;

    -- Store pickup coords separately for the geofence check
    SELECT pickup_lat, pickup_lng, delivery_lat, delivery_lng
    INTO v_load
    FROM daily_loads
    WHERE id = p_load_id;

    -- Geofence enforcement for pickup (in_progress) and delivery (delivered)
    IF p_status = 'in_progress' AND p_lat IS NOT NULL AND p_lng IS NOT NULL THEN
        v_target_lat := v_load.pickup_lat;
        v_target_lng := v_load.pickup_lng;

        IF v_target_lat IS NOT NULL AND v_target_lng IS NOT NULL THEN
            -- Haversine distance in meters
            v_distance := 6371000 * 2 * ASIN(SQRT(
                POWER(SIN(RADIANS(v_target_lat - p_lat) / 2), 2) +
                COS(RADIANS(p_lat)) * COS(RADIANS(v_target_lat)) *
                POWER(SIN(RADIANS(v_target_lng - p_lng) / 2), 2)
            ));

            IF v_distance > v_geofence_radius THEN
                RETURN jsonb_build_object(
                    'success', false,
                    'error', 'Too far from pickup location (' || ROUND(v_distance) || 'm away, max ' || v_geofence_radius || 'm)'
                );
            END IF;
        END IF;
    END IF;

    IF p_status = 'delivered' AND p_lat IS NOT NULL AND p_lng IS NOT NULL THEN
        v_target_lat := v_load.delivery_lat;
        v_target_lng := v_load.delivery_lng;

        IF v_target_lat IS NOT NULL AND v_target_lng IS NOT NULL THEN
            v_distance := 6371000 * 2 * ASIN(SQRT(
                POWER(SIN(RADIANS(v_target_lat - p_lat) / 2), 2) +
                COS(RADIANS(p_lat)) * COS(RADIANS(v_target_lat)) *
                POWER(SIN(RADIANS(v_target_lng - p_lng) / 2), 2)
            ));

            IF v_distance > v_geofence_radius THEN
                RETURN jsonb_build_object(
                    'success', false,
                    'error', 'Too far from delivery location (' || ROUND(v_distance) || 'm away, max ' || v_geofence_radius || 'm)'
                );
            END IF;
        END IF;
    END IF;

    -- Update load
    UPDATE daily_loads
    SET
        status = p_status,
        actual_pickup = CASE WHEN p_status = 'in_progress' THEN v_now ELSE actual_pickup END,
        actual_delivery = CASE WHEN p_status = 'delivered' THEN v_now ELSE actual_delivery END,
        updated_at = v_now
    WHERE id = p_load_id;

    -- Log event with CORRECT column names
    INSERT INTO load_status_events (load_id, changed_by, previous_status, new_status, reason, latitude, longitude, created_at)
    VALUES (p_load_id, p_driver_id::text, v_current_status, p_status, p_notes, p_lat, p_lng, v_now);

    RETURN jsonb_build_object('success', true, 'load_id', p_load_id, 'status', p_status);
END;
$$;

-- ================================================================
-- 4. Update tracking token trigger to generate 8 chars
--    Old: 6 hex chars from MD5 (only 16^6 = 16.7M combinations)
--    New: 8 alphanumeric chars (36^8 = 2.8 trillion combinations)
-- ================================================================
CREATE OR REPLACE FUNCTION generate_tracking_token()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    v_chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    v_token TEXT := 'ANK-';
    v_i INT;
BEGIN
    IF NEW.tracking_token IS NULL THEN
        FOR v_i IN 1..8 LOOP
            v_token := v_token || substr(v_chars, floor(random() * 36 + 1)::int, 1);
        END LOOP;
        NEW.tracking_token := v_token;
    END IF;
    RETURN NEW;
END;
$$;
