-- CHUNK 3/3: Tracking RPC + Geofence arrival RPC
-- Paste this into SQL Editor and click RUN

-- Enhanced customer tracking RPC with POD photos
CREATE OR REPLACE FUNCTION get_tracking_info(p_token text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE result json;
BEGIN
    SELECT json_build_object(
        'found', true,
        'reference_number', dl.reference_number,
        'status', dl.status,
        'service_type', dl.service_type,
        'packages', dl.packages,
        'pickup_address', dl.pickup_address,
        'delivery_address', dl.delivery_address,
        'customer_name', dl.customer_name,
        'estimated_arrival', dl.estimated_arrival,
        'load_date', dl.load_date,
        'start_time', dl.start_time,
        'end_time', dl.end_time,
        'pod_confirmed', dl.pod_confirmed,
        'wait_time_minutes', dl.wait_time_minutes,
        'driver_name', d.full_name,
        'hub', dl.hub,
        'driver_lat', loc.latitude,
        'driver_lng', loc.longitude,
        'driver_speed', loc.speed,
        'driver_heading', loc.heading,
        'driver_last_seen', loc.recorded_at,
        'pod_photo_url', pod.photo_url,
        'pod_signature_url', pod.signature_url,
        'pod_signer_name', pod.signer_name,
        'pod_captured_at', pod.captured_at,
        'status_history', (
            SELECT json_agg(json_build_object(
                'status', lse.new_status,
                'timestamp', lse.created_at,
                'note', lse.reason
            ) ORDER BY lse.created_at ASC)
            FROM load_status_events lse WHERE lse.load_id = dl.id
        )
    ) INTO result
    FROM daily_loads dl
    LEFT JOIN drivers d ON d.id = dl.driver_id
    LEFT JOIN LATERAL (
        SELECT latitude, longitude, speed, heading, recorded_at
        FROM driver_locations WHERE driver_id = dl.driver_id
        ORDER BY recorded_at DESC LIMIT 1
    ) loc ON true
    LEFT JOIN LATERAL (
        SELECT photo_url, signature_url, signer_name, captured_at
        FROM pod_submissions WHERE load_id = dl.id
        ORDER BY captured_at DESC LIMIT 1
    ) pod ON true
    WHERE dl.tracking_token = p_token;

    IF result IS NULL THEN RETURN json_build_object('found', false); END IF;
    RETURN result;
END;
$$;

-- Geofence arrival RPC (auto-detect pickup/delivery arrival)
CREATE OR REPLACE FUNCTION trigger_geofence_arrival(
    p_load_id UUID, p_driver_id UUID, p_event_type TEXT,
    p_latitude DECIMAL, p_longitude DECIMAL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_now TIMESTAMPTZ := now();
    v_current_status TEXT;
BEGIN
    IF p_event_type NOT IN ('arrived_pickup', 'arrived_delivery') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid event type: ' || p_event_type);
    END IF;

    SELECT status INTO v_current_status FROM daily_loads WHERE id = p_load_id;
    IF v_current_status IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Load not found');
    END IF;

    IF p_event_type = 'arrived_pickup' AND v_current_status NOT IN ('assigned', 'in_progress') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Load not in valid state for pickup arrival');
    END IF;
    IF p_event_type = 'arrived_delivery' AND v_current_status NOT IN ('in_progress', 'in_transit', 'arrived_pickup') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Load not in valid state for delivery arrival');
    END IF;

    UPDATE daily_loads SET status = p_event_type, updated_at = v_now WHERE id = p_load_id;

    INSERT INTO load_status_events (load_id, changed_by, previous_status, new_status, reason, latitude, longitude, created_at)
    VALUES (p_load_id, p_driver_id::text, v_current_status, p_event_type,
        'Auto-detected by GPS geofence (' || ROUND(p_latitude::numeric, 6) || ', ' || ROUND(p_longitude::numeric, 6) || ')',
        p_latitude, p_longitude, v_now);

    RETURN jsonb_build_object('success', true, 'load_id', p_load_id, 'event', p_event_type);
END;
$$;
