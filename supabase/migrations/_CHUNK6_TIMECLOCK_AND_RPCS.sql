-- CHUNK 6: TimeClock subsystem + remaining broken/missing RPCs
-- Creates: time_entries, time_breaks tables + views + RPCs
-- Fixes: get_driver_performance, get_driver_suggestion (search_path)
-- Creates: confirm_blast_assignment RPC
-- Paste into SQL Editor and click RUN

-- ═══════════════════════════════════════════════════════════════════════
-- A. time_entries table -- driver clock-in/out records
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS time_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id UUID NOT NULL REFERENCES drivers(id),
    clock_in TIMESTAMPTZ NOT NULL DEFAULT now(),
    clock_out TIMESTAMPTZ,
    break_minutes INT DEFAULT 0,
    total_minutes INT,
    regular_hours DECIMAL(6,2),
    overtime_hours DECIMAL(6,2),
    total_pay DECIMAL(10,2),
    hub TEXT NOT NULL DEFAULT 'PHX',
    shift TEXT NOT NULL DEFAULT 'day',
    work_date DATE NOT NULL DEFAULT CURRENT_DATE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_time_entries_driver_id ON time_entries(driver_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_work_date ON time_entries(work_date);

ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS time_entries_select ON time_entries;
CREATE POLICY time_entries_select ON time_entries FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS time_entries_insert ON time_entries;
CREATE POLICY time_entries_insert ON time_entries FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS time_entries_update ON time_entries;
CREATE POLICY time_entries_update ON time_entries FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS time_entries_delete ON time_entries;
CREATE POLICY time_entries_delete ON time_entries FOR DELETE TO authenticated USING (true);

-- ═══════════════════════════════════════════════════════════════════════
-- B. time_breaks table -- break periods within a shift
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS time_breaks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    time_entry_id UUID NOT NULL REFERENCES time_entries(id) ON DELETE CASCADE,
    driver_id UUID NOT NULL REFERENCES drivers(id),
    break_type TEXT NOT NULL DEFAULT 'break' CHECK (break_type IN ('break', 'lunch')),
    break_start TIMESTAMPTZ NOT NULL DEFAULT now(),
    break_end TIMESTAMPTZ,
    break_minutes INT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_time_breaks_entry ON time_breaks(time_entry_id);

ALTER TABLE time_breaks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS time_breaks_select ON time_breaks;
CREATE POLICY time_breaks_select ON time_breaks FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS time_breaks_insert ON time_breaks;
CREATE POLICY time_breaks_insert ON time_breaks FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS time_breaks_update ON time_breaks;
CREATE POLICY time_breaks_update ON time_breaks FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════════════════
-- C. v_active_clocks view -- currently clocked-in drivers
-- ═══════════════════════════════════════════════════════════════════════
CREATE OR REPLACE VIEW v_active_clocks AS
SELECT
    te.id AS entry_id,
    te.driver_id,
    d.full_name AS driver_name,
    d.hourly_rate,
    te.hub,
    te.shift,
    te.clock_in,
    te.work_date,
    EXTRACT(EPOCH FROM (now() - te.clock_in))::INT / 60 AS elapsed_minutes,
    (ab.id IS NOT NULL) AS on_break,
    ab.id AS active_break_id,
    COALESCE(te.break_minutes, 0) AS break_minutes
FROM time_entries te
JOIN drivers d ON d.id = te.driver_id
LEFT JOIN LATERAL (
    SELECT tb.id FROM time_breaks tb
    WHERE tb.time_entry_id = te.id AND tb.break_end IS NULL
    ORDER BY tb.break_start DESC LIMIT 1
) ab ON true
WHERE te.clock_out IS NULL;

-- ═══════════════════════════════════════════════════════════════════════
-- D. v_payroll_summary view -- weekly payroll aggregation
-- ═══════════════════════════════════════════════════════════════════════
CREATE OR REPLACE VIEW v_payroll_summary AS
SELECT
    te.driver_id,
    d.full_name,
    d.hourly_rate,
    d.hub,
    DATE_TRUNC('week', te.work_date)::DATE AS week_start,
    COUNT(*)::INT AS shifts,
    SUM(COALESCE(te.total_minutes, 0))::INT AS total_work_minutes,
    SUM(COALESCE(te.regular_hours, 0))::DECIMAL(8,2) AS total_regular_hours,
    SUM(COALESCE(te.overtime_hours, 0))::DECIMAL(8,2) AS total_overtime_hours,
    SUM(COALESCE(te.total_pay, 0))::DECIMAL(10,2) AS total_pay
FROM time_entries te
JOIN drivers d ON d.id = te.driver_id
WHERE te.clock_out IS NOT NULL
  AND te.work_date >= CURRENT_DATE - INTERVAL '8 weeks'
GROUP BY te.driver_id, d.full_name, d.hourly_rate, d.hub, DATE_TRUNC('week', te.work_date)
ORDER BY week_start DESC, d.full_name;

-- ═══════════════════════════════════════════════════════════════════════
-- E. clock_in_driver RPC
-- ═══════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION clock_in_driver(
    p_driver_id UUID, p_hub TEXT, p_shift TEXT, p_notes TEXT DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_entry_id UUID;
BEGIN
    -- Check not already clocked in
    IF EXISTS (SELECT 1 FROM time_entries WHERE driver_id = p_driver_id AND clock_out IS NULL) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Driver is already clocked in');
    END IF;

    INSERT INTO time_entries (driver_id, hub, shift, notes, work_date, clock_in)
    VALUES (p_driver_id, p_hub, p_shift, p_notes, CURRENT_DATE, now())
    RETURNING id INTO v_entry_id;

    -- Update driver_shifts too
    INSERT INTO driver_shifts (driver_id, hub, start_time, status)
    VALUES (p_driver_id, p_hub, now(), 'on_duty');

    RETURN jsonb_build_object('success', true, 'entry_id', v_entry_id);
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════
-- F. clock_out_driver RPC
-- ═══════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION clock_out_driver(p_entry_id UUID, p_notes TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_entry RECORD;
    v_total_min INT;
    v_break_min INT;
    v_work_min INT;
    v_reg DECIMAL;
    v_ot DECIMAL;
    v_rate DECIMAL;
    v_pay DECIMAL;
BEGIN
    -- Close any open breaks first
    UPDATE time_breaks SET
        break_end = now(),
        break_minutes = EXTRACT(EPOCH FROM (now() - break_start))::INT / 60
    WHERE time_entry_id = p_entry_id AND break_end IS NULL;

    -- Get entry + driver rate
    SELECT te.*, d.hourly_rate INTO v_entry
    FROM time_entries te
    JOIN drivers d ON d.id = te.driver_id
    WHERE te.id = p_entry_id AND te.clock_out IS NULL;

    IF v_entry IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Entry not found or already clocked out');
    END IF;

    v_total_min := EXTRACT(EPOCH FROM (now() - v_entry.clock_in))::INT / 60;
    SELECT COALESCE(SUM(break_minutes), 0) INTO v_break_min
    FROM time_breaks WHERE time_entry_id = p_entry_id;

    v_work_min := GREATEST(v_total_min - v_break_min, 0);
    v_rate := v_entry.hourly_rate;

    -- Regular = first 8 hours, overtime = beyond 8
    IF v_work_min <= 480 THEN
        v_reg := ROUND(v_work_min / 60.0, 2);
        v_ot := 0;
    ELSE
        v_reg := 8.00;
        v_ot := ROUND((v_work_min - 480) / 60.0, 2);
    END IF;

    v_pay := ROUND((v_reg * v_rate) + (v_ot * v_rate * 1.5), 2);

    UPDATE time_entries SET
        clock_out = now(),
        break_minutes = v_break_min,
        total_minutes = v_work_min,
        regular_hours = v_reg,
        overtime_hours = v_ot,
        total_pay = v_pay,
        notes = COALESCE(p_notes, notes),
        updated_at = now()
    WHERE id = p_entry_id;

    -- End driver shift
    UPDATE driver_shifts SET end_time = now(), status = 'off_duty', updated_at = now()
    WHERE driver_id = v_entry.driver_id AND end_time IS NULL;

    RETURN jsonb_build_object(
        'success', true,
        'total_minutes', v_work_min,
        'break_minutes', v_break_min,
        'regular_hours', v_reg,
        'overtime_hours', v_ot,
        'hourly_rate', v_rate,
        'total_pay', v_pay
    );
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════
-- G. start_break RPC
-- ═══════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION start_break(p_entry_id UUID, p_driver_id UUID, p_type TEXT DEFAULT 'break')
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_break_id UUID;
BEGIN
    -- Check no active break already
    IF EXISTS (SELECT 1 FROM time_breaks WHERE time_entry_id = p_entry_id AND break_end IS NULL) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Already on break');
    END IF;

    INSERT INTO time_breaks (time_entry_id, driver_id, break_type, break_start)
    VALUES (p_entry_id, p_driver_id, p_type, now())
    RETURNING id INTO v_break_id;

    RETURN jsonb_build_object('success', true, 'break_id', v_break_id);
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════
-- H. end_break RPC
-- ═══════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION end_break(p_break_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_minutes INT;
BEGIN
    UPDATE time_breaks SET
        break_end = now(),
        break_minutes = EXTRACT(EPOCH FROM (now() - break_start))::INT / 60
    WHERE id = p_break_id AND break_end IS NULL
    RETURNING break_minutes INTO v_minutes;

    IF v_minutes IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Break not found or already ended');
    END IF;

    RETURN jsonb_build_object('success', true, 'break_minutes', v_minutes);
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════
-- I. get_driver_performance RPC (fix search_path)
-- ═══════════════════════════════════════════════════════════════════════
DROP FUNCTION IF EXISTS get_driver_performance(DATE, DATE);
CREATE OR REPLACE FUNCTION get_driver_performance(p_start_date DATE, p_end_date DATE)
RETURNS TABLE(
    driver_id UUID,
    driver_name TEXT,
    hub TEXT,
    total_loads BIGINT,
    delivered_loads BIGINT,
    failed_loads BIGINT,
    on_time_rate DECIMAL,
    total_revenue DECIMAL,
    total_miles DECIMAL,
    avg_revenue_per_load DECIMAL,
    pod_compliance_rate DECIMAL
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    RETURN QUERY
    SELECT
        d.id AS driver_id,
        d.full_name::TEXT AS driver_name,
        d.hub::TEXT AS hub,
        COUNT(dl.id) AS total_loads,
        COUNT(dl.id) FILTER (WHERE dl.status IN ('delivered', 'completed')) AS delivered_loads,
        COUNT(dl.id) FILTER (WHERE dl.status IN ('failed', 'cancelled')) AS failed_loads,
        CASE WHEN COUNT(dl.id) FILTER (WHERE dl.status IN ('delivered', 'completed')) > 0
            THEN ROUND(
                COUNT(dl.id) FILTER (
                    WHERE dl.status IN ('delivered', 'completed')
                    AND dl.actual_delivery IS NOT NULL
                    AND dl.end_time IS NOT NULL
                    AND dl.actual_delivery <= (dl.load_date || ' ' || dl.end_time)::TIMESTAMPTZ + INTERVAL '15 minutes'
                )::DECIMAL / NULLIF(COUNT(dl.id) FILTER (WHERE dl.status IN ('delivered', 'completed')), 0) * 100, 1
            )
            ELSE 0
        END AS on_time_rate,
        COALESCE(SUM(dl.revenue), 0) AS total_revenue,
        COALESCE(SUM(dl.miles), 0) AS total_miles,
        CASE WHEN COUNT(dl.id) > 0
            THEN ROUND(COALESCE(SUM(dl.revenue), 0) / COUNT(dl.id), 2)
            ELSE 0
        END AS avg_revenue_per_load,
        CASE WHEN COUNT(dl.id) FILTER (WHERE dl.status IN ('delivered', 'completed')) > 0
            THEN ROUND(
                COUNT(dl.id) FILTER (WHERE dl.pod_confirmed = true)::DECIMAL /
                NULLIF(COUNT(dl.id) FILTER (WHERE dl.status IN ('delivered', 'completed')), 0) * 100, 1
            )
            ELSE 0
        END AS pod_compliance_rate
    FROM drivers d
    LEFT JOIN daily_loads dl ON dl.driver_id = d.id
        AND dl.load_date BETWEEN p_start_date AND p_end_date
    WHERE d.status = 'active'
    GROUP BY d.id, d.full_name, d.hub
    ORDER BY total_loads DESC;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════
-- J. get_driver_suggestion RPC (fix search_path)
-- ═══════════════════════════════════════════════════════════════════════
DROP FUNCTION IF EXISTS get_driver_suggestion(UUID, DECIMAL, DECIMAL, TEXT);
CREATE OR REPLACE FUNCTION get_driver_suggestion(
    p_load_id UUID, p_pickup_lat DECIMAL, p_pickup_lng DECIMAL,
    p_cutoff_time TEXT DEFAULT NULL
)
RETURNS TABLE(
    driver_id UUID,
    driver_name TEXT,
    distance_km DECIMAL,
    active_loads_count BIGINT,
    eta_to_pickup_min DECIMAL,
    eta_to_delivery_min DECIMAL,
    estimated_arrival_at_delivery TEXT,
    cutoff_margin_min DECIMAL,
    can_meet_cutoff BOOLEAN,
    driver_status TEXT,
    score DECIMAL
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    RETURN QUERY
    SELECT
        d.id AS driver_id,
        d.full_name::TEXT AS driver_name,
        ROUND(
            6371 * 2 * ASIN(SQRT(
                POWER(SIN(RADIANS(COALESCE(loc.latitude, 0) - p_pickup_lat) / 2), 2) +
                COS(RADIANS(p_pickup_lat)) * COS(RADIANS(COALESCE(loc.latitude, 0))) *
                POWER(SIN(RADIANS(COALESCE(loc.longitude, 0) - p_pickup_lng) / 2), 2)
            ))::DECIMAL, 2
        ) AS distance_km,
        COALESCE(loads.cnt, 0) AS active_loads_count,
        ROUND(
            6371 * 2 * ASIN(SQRT(
                POWER(SIN(RADIANS(COALESCE(loc.latitude, 0) - p_pickup_lat) / 2), 2) +
                COS(RADIANS(p_pickup_lat)) * COS(RADIANS(COALESCE(loc.latitude, 0))) *
                POWER(SIN(RADIANS(COALESCE(loc.longitude, 0) - p_pickup_lng) / 2), 2)
            ))::DECIMAL / 0.8 * 60, 0  -- ~48 km/h avg speed
        ) AS eta_to_pickup_min,
        0::DECIMAL AS eta_to_delivery_min,
        ''::TEXT AS estimated_arrival_at_delivery,
        NULL::DECIMAL AS cutoff_margin_min,
        true AS can_meet_cutoff,
        CASE WHEN COALESCE(loads.cnt, 0) = 0 THEN 'available' ELSE 'on_delivery' END::TEXT AS driver_status,
        -- Score: lower distance + fewer active loads = higher score
        ROUND(100 - LEAST(
            6371 * 2 * ASIN(SQRT(
                POWER(SIN(RADIANS(COALESCE(loc.latitude, 0) - p_pickup_lat) / 2), 2) +
                COS(RADIANS(p_pickup_lat)) * COS(RADIANS(COALESCE(loc.latitude, 0))) *
                POWER(SIN(RADIANS(COALESCE(loc.longitude, 0) - p_pickup_lng) / 2), 2)
            ))::DECIMAL, 50
        ) - COALESCE(loads.cnt, 0) * 10, 1) AS score
    FROM drivers d
    LEFT JOIN LATERAL (
        SELECT dl2.latitude, dl2.longitude
        FROM driver_locations dl2
        WHERE dl2.driver_id = d.id
        ORDER BY dl2.recorded_at DESC LIMIT 1
    ) loc ON true
    LEFT JOIN LATERAL (
        SELECT COUNT(*)::BIGINT AS cnt
        FROM daily_loads al
        WHERE al.driver_id = d.id
          AND al.load_date = CURRENT_DATE
          AND al.status IN ('assigned', 'in_progress', 'in_transit')
    ) loads ON true
    WHERE d.status = 'active'
      AND loc.latitude IS NOT NULL
    ORDER BY score DESC
    LIMIT 5;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════
-- K. confirm_blast_assignment RPC
-- ═══════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION confirm_blast_assignment(p_blast_id UUID, p_driver_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_load_id UUID;
BEGIN
    -- Get the load_id from the blast
    SELECT load_id INTO v_load_id FROM dispatch_blasts WHERE id = p_blast_id;
    IF v_load_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Blast not found');
    END IF;

    -- Assign the driver to the load
    UPDATE daily_loads SET
        driver_id = p_driver_id,
        status = 'assigned',
        updated_at = now()
    WHERE id = v_load_id;

    -- Update blast status
    UPDATE dispatch_blasts SET
        status = 'assigned',
        updated_at = now()
    WHERE id = p_blast_id;

    -- Mark the driver's response as accepted
    UPDATE blast_responses SET
        status = 'accepted'
    WHERE blast_id = p_blast_id AND driver_id = p_driver_id;

    -- Decline all other responses
    UPDATE blast_responses SET
        status = 'declined'
    WHERE blast_id = p_blast_id AND driver_id != p_driver_id AND status = 'interested';

    RETURN jsonb_build_object('success', true, 'load_id', v_load_id);
END;
$$;
