-- ═══════════════════════════════════════════════════════════
-- Customer Tracking — Public delivery tracking + Route optimization
-- ═══════════════════════════════════════════════════════════

-- Add tracking token to daily_loads for public tracking links
ALTER TABLE daily_loads
    ADD COLUMN IF NOT EXISTS tracking_token text UNIQUE,
    ADD COLUMN IF NOT EXISTS customer_name text,
    ADD COLUMN IF NOT EXISTS customer_phone text,
    ADD COLUMN IF NOT EXISTS customer_email text,
    ADD COLUMN IF NOT EXISTS estimated_arrival text,       -- HH:MM format
    ADD COLUMN IF NOT EXISTS route_order smallint DEFAULT 0,
    ADD COLUMN IF NOT EXISTS pickup_lat double precision,
    ADD COLUMN IF NOT EXISTS pickup_lng double precision,
    ADD COLUMN IF NOT EXISTS delivery_lat double precision,
    ADD COLUMN IF NOT EXISTS delivery_lng double precision;

-- Auto-generate tracking token on insert
CREATE OR REPLACE FUNCTION generate_tracking_token()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.tracking_token IS NULL THEN
        -- Format: ANK-XXXXXX (short, branded, easy to share)
        NEW.tracking_token := 'ANK-' || upper(substr(md5(gen_random_uuid()::text), 1, 6));
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_daily_loads_tracking_token
    BEFORE INSERT ON daily_loads
    FOR EACH ROW EXECUTE FUNCTION generate_tracking_token();

-- ─── Public tracking lookup (no auth required) ────────
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
        'status_history', (
            SELECT json_agg(json_build_object(
                'status', lse.new_status,
                'timestamp', lse.recorded_at,
                'note', lse.note
            ) ORDER BY lse.recorded_at ASC)
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
    WHERE dl.tracking_token = p_token;

    IF result IS NULL THEN
        RETURN json_build_object('found', false);
    END IF;

    RETURN result;
END;
$$;
