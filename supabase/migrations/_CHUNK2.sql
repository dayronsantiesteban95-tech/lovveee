-- CHUNK 2/3: Fix load_status_events + update_load_status RPC + tracking token
-- Paste this into SQL Editor and click RUN

-- Add lat/lng columns to load_status_events
ALTER TABLE load_status_events
    ADD COLUMN IF NOT EXISTS latitude double precision,
    ADD COLUMN IF NOT EXISTS longitude double precision;

-- Fix RLS policy
DROP POLICY IF EXISTS load_events_insert ON load_status_events;
CREATE POLICY load_events_insert ON load_status_events
    FOR INSERT TO authenticated WITH CHECK (true);

-- Fix update_load_status RPC with correct column names + geofence enforcement
CREATE OR REPLACE FUNCTION update_load_status(
    p_load_id UUID, p_driver_id UUID, p_status TEXT,
    p_lat DECIMAL DEFAULT NULL, p_lng DECIMAL DEFAULT NULL, p_notes TEXT DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_now TIMESTAMPTZ := now();
    v_load RECORD;
    v_current_status TEXT;
    v_target_lat DECIMAL;
    v_target_lng DECIMAL;
    v_distance DECIMAL;
    v_geofence_radius DECIMAL := 200;
BEGIN
    IF p_status NOT IN (
        'pending','assigned','blasted','in_progress',
        'arrived_pickup','in_transit','arrived_delivery',
        'delivered','completed','cancelled','failed'
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid status: ' || p_status);
    END IF;

    SELECT status INTO v_current_status FROM daily_loads WHERE id = p_load_id;

    SELECT pickup_lat, pickup_lng, delivery_lat, delivery_lng
    INTO v_load FROM daily_loads WHERE id = p_load_id;

    -- Geofence: pickup
    IF p_status = 'in_progress' AND p_lat IS NOT NULL AND p_lng IS NOT NULL THEN
        v_target_lat := v_load.pickup_lat; v_target_lng := v_load.pickup_lng;
        IF v_target_lat IS NOT NULL AND v_target_lng IS NOT NULL THEN
            v_distance := 6371000 * 2 * ASIN(SQRT(
                POWER(SIN(RADIANS(v_target_lat - p_lat) / 2), 2) +
                COS(RADIANS(p_lat)) * COS(RADIANS(v_target_lat)) *
                POWER(SIN(RADIANS(v_target_lng - p_lng) / 2), 2)));
            IF v_distance > v_geofence_radius THEN
                RETURN jsonb_build_object('success', false,
                    'error', 'Too far from pickup (' || ROUND(v_distance) || 'm away, max ' || v_geofence_radius || 'm)');
            END IF;
        END IF;
    END IF;

    -- Geofence: delivery
    IF p_status = 'delivered' AND p_lat IS NOT NULL AND p_lng IS NOT NULL THEN
        v_target_lat := v_load.delivery_lat; v_target_lng := v_load.delivery_lng;
        IF v_target_lat IS NOT NULL AND v_target_lng IS NOT NULL THEN
            v_distance := 6371000 * 2 * ASIN(SQRT(
                POWER(SIN(RADIANS(v_target_lat - p_lat) / 2), 2) +
                COS(RADIANS(p_lat)) * COS(RADIANS(v_target_lat)) *
                POWER(SIN(RADIANS(v_target_lng - p_lng) / 2), 2)));
            IF v_distance > v_geofence_radius THEN
                RETURN jsonb_build_object('success', false,
                    'error', 'Too far from delivery (' || ROUND(v_distance) || 'm away, max ' || v_geofence_radius || 'm)');
            END IF;
        END IF;
    END IF;

    UPDATE daily_loads SET
        status = p_status,
        actual_pickup = CASE WHEN p_status = 'in_progress' THEN v_now ELSE actual_pickup END,
        actual_delivery = CASE WHEN p_status = 'delivered' THEN v_now ELSE actual_delivery END,
        updated_at = v_now
    WHERE id = p_load_id;

    INSERT INTO load_status_events (load_id, changed_by, previous_status, new_status, reason, latitude, longitude, created_at)
    VALUES (p_load_id, p_driver_id::text, v_current_status, p_status, p_notes, p_lat, p_lng, v_now);

    RETURN jsonb_build_object('success', true, 'load_id', p_load_id, 'status', p_status);
END;
$$;

-- Update tracking token trigger to 8 chars
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
