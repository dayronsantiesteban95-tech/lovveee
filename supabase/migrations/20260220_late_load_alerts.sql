-- ════════════════════════════════════════════════════════════════════════════
-- Late Load Alerts — Dispatcher Notification System
-- Runs every hour via OpenClaw cron → calls check_late_loads()
-- Creates notifications in the `notifications` table for:
--   1. Loads in_progress past their SLA deadline
--   2. Loads in_progress > 4 hours with no status update
-- ════════════════════════════════════════════════════════════════════════════

-- Function to alert dispatchers about late loads
CREATE OR REPLACE FUNCTION check_late_loads()
RETURNS TABLE(load_id uuid, reference_number text, client_name text, alert_type text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  load_rec RECORD;
  dispatcher_rec RECORD;
  alert_count integer := 0;
BEGIN
  -- Get all dispatchers to notify
  -- Loop through loads that are in_progress and potentially late
  FOR load_rec IN
    SELECT
      dl.id,
      dl.reference_number,
      dl.client_name,
      dl.dispatcher_id,
      dl.start_time,
      dl.sla_deadline,
      dl.eta_status,
      dl.hub,
      dl.service_type,
      CASE
        WHEN dl.sla_deadline IS NOT NULL AND dl.sla_deadline::timestamptz < NOW() THEN 'sla_breached'
        WHEN dl.start_time IS NOT NULL AND dl.start_time::timestamptz < NOW() - INTERVAL '4 hours' THEN 'no_update_4h'
        ELSE 'at_risk'
      END as alert_type,
      ABS(EXTRACT(EPOCH FROM (NOW() - COALESCE(dl.sla_deadline::timestamptz, dl.start_time::timestamptz + INTERVAL '4 hours'))) / 60)::integer as minutes_late
    FROM daily_loads dl
    WHERE
      dl.status = 'in_progress'
      AND (
        -- SLA breached
        (dl.sla_deadline IS NOT NULL AND dl.sla_deadline::timestamptz < NOW())
        OR
        -- In progress for 4+ hours with no update
        (dl.start_time IS NOT NULL AND dl.start_time::timestamptz < NOW() - INTERVAL '4 hours')
      )
      AND dl.dispatcher_id IS NOT NULL
  LOOP
    -- Insert notification for the dispatcher if not already notified in last hour
    INSERT INTO notifications (user_id, title, message, type, read, is_read, triggered_by)
    SELECT
      load_rec.dispatcher_id,
      CASE load_rec.alert_type
        WHEN 'sla_breached' THEN '🚨 SLA BREACHED — ' || COALESCE(load_rec.reference_number, 'Load')
        WHEN 'no_update_4h' THEN '⚠️ No Update (4h) — ' || COALESCE(load_rec.reference_number, 'Load')
        ELSE '⏰ At Risk — ' || COALESCE(load_rec.reference_number, 'Load')
      END,
      CASE load_rec.alert_type
        WHEN 'sla_breached' THEN 'Load ' || COALESCE(load_rec.reference_number, load_rec.id::text) || ' for ' || COALESCE(load_rec.client_name, 'unknown client') || ' has BREACHED its SLA deadline. Action required immediately.'
        WHEN 'no_update_4h' THEN 'Load ' || COALESCE(load_rec.reference_number, load_rec.id::text) || ' for ' || COALESCE(load_rec.client_name, 'unknown client') || ' has been in transit for 4+ hours with no status update. Check driver status.'
        ELSE 'Load ' || COALESCE(load_rec.reference_number, load_rec.id::text) || ' is at risk of missing SLA.'
      END,
      load_rec.alert_type,
      false,
      false,
      load_rec.dispatcher_id
    WHERE NOT EXISTS (
      SELECT 1 FROM notifications n
      WHERE n.user_id = load_rec.dispatcher_id
      AND n.type = load_rec.alert_type
      AND n.message LIKE '%' || COALESCE(load_rec.reference_number, load_rec.id::text) || '%'
      AND n.created_at > NOW() - INTERVAL '1 hour'
    );

    -- Return info about what was processed
    load_id := load_rec.id;
    reference_number := load_rec.reference_number;
    client_name := load_rec.client_name;
    alert_type := load_rec.alert_type;
    alert_count := alert_count + 1;
    RETURN NEXT;
  END LOOP;

  RAISE LOG '[check_late_loads] Generated % late load alerts', alert_count;
END;
$$;

-- Grant execute to service_role (called by cron)
GRANT EXECUTE ON FUNCTION check_late_loads() TO service_role;

-- ════════════════════════════════════════════════════════════════════════════
-- CRON SETUP NOTES (for when pg_cron is enabled):
-- SELECT cron.schedule('late-load-alerts', '0 * * * *', 'SELECT check_late_loads()');
-- SELECT cron.schedule('gps-cleanup', '*/30 * * * *', 'SELECT cleanup_old_gps_pings()');
-- SELECT cron.schedule('car-wash-check', '0 6 * * *', 'SELECT check_car_wash_due()');
-- 
-- Currently being called via OpenClaw cron jobs (see TASK_QUEUE.md — cron section)
-- ════════════════════════════════════════════════════════════════════════════
