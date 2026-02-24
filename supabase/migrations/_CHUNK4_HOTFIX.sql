-- CHUNK 4: Missing RPCs (increment_blast_stat + get_driver_shift_summary)
-- Paste into SQL Editor and click RUN

-- increment_blast_stat: atomically increment a counter on dispatch_blasts
CREATE OR REPLACE FUNCTION increment_blast_stat(p_blast_id UUID, p_field TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    IF p_field = 'drivers_declined' THEN
        UPDATE dispatch_blasts
        SET drivers_declined = COALESCE(drivers_declined, 0) + 1
        WHERE id = p_blast_id;
    ELSIF p_field = 'drivers_interested' THEN
        UPDATE dispatch_blasts
        SET drivers_interested = COALESCE(drivers_interested, 0) + 1
        WHERE id = p_blast_id;
    ELSIF p_field = 'drivers_contacted' THEN
        UPDATE dispatch_blasts
        SET drivers_contacted = COALESCE(drivers_contacted, 0) + 1
        WHERE id = p_blast_id;
    END IF;
END;
$$;

-- get_driver_shift_summary: daily summary for driver app summary tab
CREATE OR REPLACE FUNCTION get_driver_shift_summary(p_driver_id UUID, p_date DATE)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'total_loads', COUNT(*),
        'completed_loads', COUNT(*) FILTER (WHERE dl.status IN ('completed', 'delivered')),
        'failed_loads', COUNT(*) FILTER (WHERE dl.status IN ('failed', 'cancelled')),
        'total_revenue', COALESCE(SUM(dl.total_charge), 0),
        'total_miles', COALESCE(SUM(dl.miles), 0),
        'total_packages', COALESCE(SUM(dl.packages), 0),
        'avg_revenue_per_load', CASE WHEN COUNT(*) > 0
            THEN ROUND(COALESCE(SUM(dl.total_charge), 0) / COUNT(*), 2)
            ELSE 0 END,
        'pod_submitted', COUNT(*) FILTER (WHERE dl.pod_confirmed = true),
        'on_time_count', COUNT(*) FILTER (WHERE dl.actual_delivery IS NOT NULL
            AND dl.end_time IS NOT NULL
            AND dl.actual_delivery <= (dl.load_date || ' ' || dl.end_time)::timestamptz + interval '15 minutes')
    ) INTO v_result
    FROM daily_loads dl
    WHERE dl.driver_id = p_driver_id
      AND dl.load_date = p_date;

    RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$;
