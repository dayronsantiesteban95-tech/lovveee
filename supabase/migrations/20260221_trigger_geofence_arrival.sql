-- ----------------------------------------------------------------
-- RPC: trigger_geofence_arrival
-- Called by the driver app's useGeofence hook when a driver enters
-- the 200m radius around a pickup or delivery location.
-- Updates load status to arrived_pickup or arrived_delivery.
-- ----------------------------------------------------------------

CREATE OR REPLACE FUNCTION trigger_geofence_arrival(
    p_load_id    UUID,
    p_driver_id  UUID,
    p_event_type TEXT,    -- 'arrived_pickup' or 'arrived_delivery'
    p_latitude   DECIMAL,
    p_longitude  DECIMAL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_now TIMESTAMPTZ := now();
    v_current_status TEXT;
BEGIN
    -- Validate event type
    IF p_event_type NOT IN ('arrived_pickup', 'arrived_delivery') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid event type: ' || p_event_type);
    END IF;

    -- Get current status
    SELECT status INTO v_current_status
    FROM daily_loads
    WHERE id = p_load_id;

    IF v_current_status IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Load not found');
    END IF;

    -- Only update if the load is in a valid state for this arrival
    IF p_event_type = 'arrived_pickup' AND v_current_status NOT IN ('assigned', 'in_progress') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Load not in valid state for pickup arrival');
    END IF;

    IF p_event_type = 'arrived_delivery' AND v_current_status NOT IN ('in_progress', 'in_transit', 'arrived_pickup') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Load not in valid state for delivery arrival');
    END IF;

    -- Update load status
    UPDATE daily_loads
    SET
        status = p_event_type,
        updated_at = v_now
    WHERE id = p_load_id;

    -- Log the geofence event with correct column names
    INSERT INTO load_status_events (
        load_id, changed_by, previous_status, new_status,
        reason, latitude, longitude, created_at
    )
    VALUES (
        p_load_id, p_driver_id::text, v_current_status, p_event_type,
        'Auto-detected by GPS geofence (' || ROUND(p_latitude::numeric, 6) || ', ' || ROUND(p_longitude::numeric, 6) || ')',
        p_latitude, p_longitude, v_now
    );

    RETURN jsonb_build_object('success', true, 'load_id', p_load_id, 'event', p_event_type);
END;
$$;
