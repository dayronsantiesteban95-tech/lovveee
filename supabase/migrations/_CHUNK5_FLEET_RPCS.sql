-- CHUNK 5: Fix ALL broken RPCs + add missing driver_locations columns
-- Root cause: All SECURITY DEFINER functions lack SET search_path = public
-- so they can't find tables at runtime. Fix: recreate with search_path set.
-- Also adds battery_pct, is_moving, active_load_id columns to driver_locations.
-- Paste into SQL Editor and click RUN

-- ═══════════════════════════════════════════════════════════════════════
-- A. Add missing columns to driver_locations
-- ═══════════════════════════════════════════════════════════════════════
ALTER TABLE driver_locations ADD COLUMN IF NOT EXISTS battery_pct SMALLINT;
ALTER TABLE driver_locations ADD COLUMN IF NOT EXISTS is_moving BOOLEAN DEFAULT false;
ALTER TABLE driver_locations ADD COLUMN IF NOT EXISTS active_load_id UUID;
ALTER TABLE driver_locations ADD COLUMN IF NOT EXISTS altitude DECIMAL;

-- ═══════════════════════════════════════════════════════════════════════
-- B. get_driver_positions: latest GPS position per active driver
-- Used by: dispatch map (useRealtimeDriverMap, useRealtimeDriverLocations)
-- ═══════════════════════════════════════════════════════════════════════
DROP FUNCTION IF EXISTS get_driver_positions();
CREATE OR REPLACE FUNCTION get_driver_positions()
RETURNS TABLE(
    driver_id UUID,
    driver_name TEXT,
    hub TEXT,
    latitude DECIMAL,
    longitude DECIMAL,
    speed DECIMAL,
    heading DECIMAL,
    battery_pct SMALLINT,
    is_moving BOOLEAN,
    active_load_id UUID,
    recorded_at TIMESTAMPTZ,
    shift_status TEXT
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    RETURN QUERY
    SELECT
        d.id AS driver_id,
        d.full_name::TEXT AS driver_name,
        d.hub::TEXT AS hub,
        loc.latitude,
        loc.longitude,
        loc.speed,
        loc.heading,
        loc.battery_pct,
        COALESCE(loc.is_moving, false) AS is_moving,
        loc.active_load_id,
        loc.recorded_at,
        COALESCE(sh.shift_status, 'off_duty')::TEXT AS shift_status
    FROM drivers d
    LEFT JOIN LATERAL (
        SELECT dl.latitude, dl.longitude, dl.speed, dl.heading,
               dl.battery_pct, dl.is_moving, dl.active_load_id, dl.recorded_at
        FROM driver_locations dl
        WHERE dl.driver_id = d.id
        ORDER BY dl.recorded_at DESC LIMIT 1
    ) loc ON true
    LEFT JOIN LATERAL (
        SELECT
            CASE
                WHEN ds.end_time IS NOT NULL THEN 'off_duty'
                ELSE 'on_duty'
            END AS shift_status
        FROM driver_shifts ds
        WHERE ds.driver_id = d.id AND ds.start_time::date = CURRENT_DATE
        ORDER BY ds.created_at DESC LIMIT 1
    ) sh ON true
    WHERE d.status = 'active'
      AND loc.recorded_at IS NOT NULL
      AND loc.recorded_at > NOW() - INTERVAL '2 hours'
    ORDER BY d.full_name;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════
-- C. get_fleet_inspection_status: today's inspection + car wash per vehicle
-- Used by: FleetTracker dashboard
-- ═══════════════════════════════════════════════════════════════════════
DROP FUNCTION IF EXISTS get_fleet_inspection_status();
CREATE OR REPLACE FUNCTION get_fleet_inspection_status()
RETURNS TABLE(
    vehicle_id UUID,
    vehicle_name TEXT,
    plate TEXT,
    inspection_done BOOLEAN,
    inspection_status TEXT,
    last_odometer BIGINT,
    last_car_wash DATE,
    days_since_wash INT,
    car_wash_overdue BOOLEAN
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_today DATE := CURRENT_DATE;
BEGIN
    RETURN QUERY
    SELECT
        v.id AS vehicle_id,
        v.vehicle_name::TEXT AS vehicle_name,
        v.license_plate::TEXT AS plate,
        (vi.id IS NOT NULL) AS inspection_done,
        COALESCE(vi.status, 'pending')::TEXT AS inspection_status,
        vi.odometer_reading::BIGINT AS last_odometer,
        cw.last_wash AS last_car_wash,
        COALESCE((v_today - cw.last_wash), 999)::INT AS days_since_wash,
        (COALESCE((v_today - cw.last_wash), 999) > 10) AS car_wash_overdue
    FROM vehicles v
    LEFT JOIN LATERAL (
        SELECT vi2.id, vi2.status, vi2.odometer_reading
        FROM vehicle_inspections vi2
        WHERE vi2.vehicle_id = v.id AND vi2.inspection_date = v_today
        ORDER BY vi2.created_at DESC LIMIT 1
    ) vi ON true
    LEFT JOIN LATERAL (
        SELECT MAX(w.wash_date) AS last_wash
        FROM vehicle_car_washes w
        WHERE w.vehicle_id = v.id
    ) cw ON true
    WHERE v.status = 'active'
    ORDER BY v.vehicle_name;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════
-- D. get_vehicle_odometer_history: odometer trend for a vehicle
-- Used by: FleetTracker inspection history slide-over
-- ═══════════════════════════════════════════════════════════════════════
DROP FUNCTION IF EXISTS get_vehicle_odometer_history(UUID);
CREATE OR REPLACE FUNCTION get_vehicle_odometer_history(p_vehicle_id UUID)
RETURNS TABLE(
    inspection_date DATE,
    odometer_reading BIGINT,
    driver_name TEXT
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    RETURN QUERY
    SELECT
        vi.inspection_date,
        vi.odometer_reading::BIGINT,
        d.full_name::TEXT AS driver_name
    FROM vehicle_inspections vi
    LEFT JOIN drivers d ON d.id = vi.driver_id
    WHERE vi.vehicle_id = p_vehicle_id
    ORDER BY vi.inspection_date DESC
    LIMIT 60;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════
-- E. get_uninvoiced_loads: completed loads not yet on any invoice
-- Used by: Billing module uninvoiced queue
-- ═══════════════════════════════════════════════════════════════════════
DROP FUNCTION IF EXISTS get_uninvoiced_loads();
CREATE OR REPLACE FUNCTION get_uninvoiced_loads()
RETURNS TABLE(
    id UUID,
    reference_number TEXT,
    client_name TEXT,
    load_date DATE,
    service_type TEXT,
    revenue DECIMAL,
    status TEXT,
    driver_id UUID
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    RETURN QUERY
    SELECT
        dl.id,
        dl.reference_number::TEXT,
        dl.client_name::TEXT,
        dl.load_date,
        dl.service_type::TEXT,
        dl.revenue,
        dl.status::TEXT,
        dl.driver_id
    FROM daily_loads dl
    WHERE dl.status IN ('completed', 'delivered')
      AND NOT EXISTS (
          SELECT 1 FROM invoice_line_items ili WHERE ili.load_id = dl.id
      )
    ORDER BY dl.load_date DESC;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════
-- F. generate_invoice_number: next sequential invoice number
-- Used by: Billing module invoice creation
-- ═══════════════════════════════════════════════════════════════════════
DROP FUNCTION IF EXISTS generate_invoice_number();
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_year TEXT := TO_CHAR(CURRENT_DATE, 'YY');
    v_max_num INT;
    v_next INT;
BEGIN
    SELECT MAX(
        CASE
            WHEN invoice_number ~ ('^INV-' || v_year || '-[0-9]+$')
            THEN CAST(SPLIT_PART(invoice_number, '-', 3) AS INT)
            ELSE 0
        END
    ) INTO v_max_num
    FROM invoices;

    v_next := COALESCE(v_max_num, 0) + 1;
    RETURN 'INV-' || v_year || '-' || LPAD(v_next::TEXT, 4, '0');
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════
-- G. get_last_contacts: most recent interaction per lead
-- Used by: Pipeline CRM page
-- ═══════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION get_last_contacts()
RETURNS TABLE(
    lead_id UUID,
    last_contact TIMESTAMPTZ
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    RETURN QUERY
    SELECT
        li.lead_id,
        MAX(li.created_at) AS last_contact
    FROM lead_interactions li
    GROUP BY li.lead_id;
END;
$$;
