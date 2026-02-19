-- ═══════════════════════════════════════════════════════════════════════════
-- GPS Cleanup — TTL-style cleanup for driver_locations table
-- Keeps only last 2 hours of GPS pings (live map only needs recent data)
-- With 20 drivers pinging every 30s → ~2,400 rows/hour → 4,800 rows max
-- ═══════════════════════════════════════════════════════════════════════════

-- Function to clean GPS pings older than 2 hours
-- Called by pg_cron every 30 minutes (if available) or Edge Function cron
CREATE OR REPLACE FUNCTION cleanup_old_gps_pings()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM driver_locations
  WHERE recorded_at < NOW() - INTERVAL '2 hours';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  -- Log cleanup for observability (optional)
  RAISE LOG '[gps-cleanup] Deleted % stale GPS rows (older than 2h)', deleted_count;
END;
$$;

-- Grant execute to authenticated users (Edge Function uses service role anyway)
GRANT EXECUTE ON FUNCTION cleanup_old_gps_pings() TO service_role;

-- ─── Schedule via pg_cron (Supabase has pg_cron enabled by default) ──────────
-- Only schedules if pg_cron extension exists; safe to run regardless
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Remove existing schedule if it exists (idempotent)
    PERFORM cron.unschedule('gps-cleanup')
    WHERE EXISTS (
      SELECT 1 FROM cron.job WHERE jobname = 'gps-cleanup'
    );

    -- Schedule every 30 minutes
    PERFORM cron.schedule(
      'gps-cleanup',
      '*/30 * * * *',
      'SELECT cleanup_old_gps_pings()'
    );

    RAISE NOTICE '[gps-cleanup] pg_cron job scheduled: every 30 minutes';
  ELSE
    RAISE NOTICE '[gps-cleanup] pg_cron not available — use Edge Function cron instead';
  END IF;
END;
$$;
