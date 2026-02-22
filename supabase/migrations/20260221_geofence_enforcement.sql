-- ----------------------------------------------------------------
-- Geofence enforcement on update_load_status RPC
-- Drivers must be within 200m of pickup/delivery to change status
-- ----------------------------------------------------------------

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

    -- Load the current load record for geofence check
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

    -- Log event
    INSERT INTO load_status_events (load_id, driver_id, status, lat, lng, notes, created_at)
    VALUES (p_load_id, p_driver_id, p_status, p_lat, p_lng, p_notes, v_now);

    RETURN jsonb_build_object('success', true, 'load_id', p_load_id, 'status', p_status);
END;
$$;
