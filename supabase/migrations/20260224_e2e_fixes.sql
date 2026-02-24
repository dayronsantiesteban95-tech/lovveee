-- E2E test fixes applied 2026-02-24
-- Fixes found during full end-to-end workflow testing

-- 1. Drop FK constraints that block drivers from logging events/messages
-- (changed_by and sender_id reference driver UUIDs, not auth.users)
ALTER TABLE load_status_events DROP CONSTRAINT IF EXISTS load_status_events_changed_by_fkey;
ALTER TABLE load_messages DROP CONSTRAINT IF EXISTS load_messages_sender_id_fkey;

-- 2. Attach tracking token trigger (function existed but trigger was missing)
DROP TRIGGER IF EXISTS set_tracking_token ON daily_loads;
CREATE TRIGGER set_tracking_token
    BEFORE INSERT ON daily_loads
    FOR EACH ROW
    EXECUTE FUNCTION generate_tracking_token();

-- 3. Convert read_by from uuid[] to jsonb for proper contains-check
ALTER TABLE load_messages ALTER COLUMN read_by DROP DEFAULT;
ALTER TABLE load_messages ALTER COLUMN read_by TYPE jsonb USING COALESCE(to_jsonb(read_by), '[]'::jsonb);
ALTER TABLE load_messages ALTER COLUMN read_by SET DEFAULT '[]'::jsonb;

-- 4. Fix get_tracking_info: customer_name->client_name, estimated_arrival->estimated_delivery
DROP FUNCTION IF EXISTS get_tracking_info(text);
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
        'customer_name', dl.client_name,
        'estimated_arrival', dl.estimated_delivery,
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

-- 5. Fix update_load_status: changed_by is UUID, no text cast
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
    VALUES (p_load_id, p_driver_id, v_current_status, p_status, p_notes, p_lat, p_lng, v_now);
    RETURN jsonb_build_object('success', true, 'load_id', p_load_id, 'status', p_status);
END;
$$;

-- 6. Fix trigger_geofence_arrival: clean overload + UUID changed_by
DROP FUNCTION IF EXISTS trigger_geofence_arrival(uuid, uuid, text, double precision, double precision, double precision);
DROP FUNCTION IF EXISTS trigger_geofence_arrival(uuid, uuid, text, numeric, numeric);
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
    VALUES (p_load_id, p_driver_id, v_current_status, p_event_type,
        'Auto-detected by GPS geofence (' || ROUND(p_latitude::numeric, 6) || ', ' || ROUND(p_longitude::numeric, 6) || ')',
        p_latitude, p_longitude, v_now);
    RETURN jsonb_build_object('success', true, 'load_id', p_load_id, 'event', p_event_type);
END;
$$;

-- 7. Fix message RPCs for jsonb read_by
CREATE OR REPLACE FUNCTION get_unread_message_counts(p_user_id UUID)
RETURNS TABLE(load_id UUID, unread_count BIGINT) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    SELECT lm.load_id, COUNT(*)::BIGINT AS unread_count
    FROM load_messages lm
    WHERE lm.sender_id != p_user_id
      AND (lm.read_by IS NULL OR NOT (lm.read_by @> to_jsonb(ARRAY[p_user_id::text])))
    GROUP BY lm.load_id HAVING COUNT(*) > 0;
END;
$$;

CREATE OR REPLACE FUNCTION mark_messages_read(p_load_id UUID, p_user_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    UPDATE load_messages
    SET read_by = CASE
        WHEN read_by IS NULL THEN jsonb_build_array(p_user_id::text)
        WHEN NOT (read_by @> to_jsonb(ARRAY[p_user_id::text])) THEN read_by || jsonb_build_array(p_user_id::text)
        ELSE read_by
    END
    WHERE load_id = p_load_id AND sender_id != p_user_id
      AND (read_by IS NULL OR NOT (read_by @> to_jsonb(ARRAY[p_user_id::text])));
END;
$$;
