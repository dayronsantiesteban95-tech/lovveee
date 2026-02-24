-- ──────────────────────────────────────────────────────────────
-- Add POD photo and signature URLs to the customer tracking RPC.
-- Previously the public tracking page could only show
-- "Proof of Delivery Confirmed" but not the actual photos.
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_tracking_info(p_token text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    result json;
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
        -- POD proof fields (new)
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
            FROM load_status_events lse
            WHERE lse.load_id = dl.id
        )
    ) INTO result
    FROM daily_loads dl
    LEFT JOIN drivers d ON d.id = dl.driver_id
    LEFT JOIN LATERAL (
        SELECT latitude, longitude, speed, heading, recorded_at
        FROM driver_locations
        WHERE driver_id = dl.driver_id
        ORDER BY recorded_at DESC
        LIMIT 1
    ) loc ON true
    LEFT JOIN LATERAL (
        SELECT photo_url, signature_url, signer_name, captured_at
        FROM pod_submissions
        WHERE load_id = dl.id
        ORDER BY captured_at DESC
        LIMIT 1
    ) pod ON true
    WHERE dl.tracking_token = p_token;

    IF result IS NULL THEN
        RETURN json_build_object('found', false);
    END IF;

    RETURN result;
END;
$$;
