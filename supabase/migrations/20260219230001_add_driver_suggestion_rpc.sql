CREATE OR REPLACE FUNCTION get_driver_suggestion(
  p_pickup_lat float8 DEFAULT NULL,
  p_pickup_lng float8 DEFAULT NULL,
  p_hub text DEFAULT NULL,
  p_cutoff_time timestamptz DEFAULT NULL
)
RETURNS TABLE (
  driver_id uuid,
  driver_name text,
  score int,
  distance_miles float8,
  status text,
  loads_today int,
  reasoning text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_today date := CURRENT_DATE;
BEGIN
  RETURN QUERY
  WITH driver_loads AS (
    SELECT dl.driver_id, COUNT(*)::int AS load_count
    FROM daily_loads dl
    WHERE dl.load_date = v_today
      AND dl.driver_id IS NOT NULL
      AND dl.status NOT IN ('cancelled', 'delivered')
    GROUP BY dl.driver_id
  ),
  driver_gps AS (
    SELECT DISTINCT ON (loc.driver_id)
      loc.driver_id,
      loc.latitude,
      loc.longitude
    FROM driver_locations loc
    WHERE loc.recorded_at > NOW() - INTERVAL '30 minutes'
    ORDER BY loc.driver_id, loc.recorded_at DESC
  ),
  scored AS (
    SELECT
      d.id AS driver_id,
      d.full_name AS driver_name,
      d.status,
      COALESCE(dl.load_count, 0) AS loads_today,
      gps.latitude,
      gps.longitude,
      CASE
        WHEN d.status = 'active' AND COALESCE(dl.load_count, 0) = 0 THEN 30
        WHEN d.status = 'active' AND COALESCE(dl.load_count, 0) = 1 THEN 20
        WHEN d.status = 'active' THEN 10
        ELSE 0
      END AS status_score,
      CASE
        WHEN gps.latitude IS NULL THEN 15
        WHEN p_pickup_lat IS NULL THEN 15
        WHEN SQRT(POW((gps.latitude - p_pickup_lat) * 69.0, 2) + POW((gps.longitude - p_pickup_lng) * 55.0, 2)) < 5 THEN 45
        WHEN SQRT(POW((gps.latitude - p_pickup_lat) * 69.0, 2) + POW((gps.longitude - p_pickup_lng) * 55.0, 2)) < 10 THEN 35
        WHEN SQRT(POW((gps.latitude - p_pickup_lat) * 69.0, 2) + POW((gps.longitude - p_pickup_lng) * 55.0, 2)) < 20 THEN 20
        ELSE 10
      END AS distance_score,
      CASE
        WHEN COALESCE(dl.load_count, 0) = 0 THEN 25
        WHEN COALESCE(dl.load_count, 0) = 1 THEN 18
        WHEN COALESCE(dl.load_count, 0) = 2 THEN 10
        ELSE 5
      END AS workload_score,
      CASE
        WHEN gps.latitude IS NOT NULL AND p_pickup_lat IS NOT NULL THEN
          ROUND(SQRT(POW((gps.latitude - p_pickup_lat) * 69.0, 2) + POW((gps.longitude - p_pickup_lng) * 55.0, 2))::numeric, 1)::float8
        ELSE NULL
      END AS dist_miles
    FROM drivers d
    LEFT JOIN driver_loads dl ON dl.driver_id = d.id
    LEFT JOIN driver_gps gps ON gps.driver_id = d.id
    WHERE d.status = 'active'
      AND (p_hub IS NULL OR lower(d.hub) = lower(p_hub))
  )
  SELECT
    s.driver_id,
    s.driver_name,
    (s.status_score + s.distance_score + s.workload_score)::int AS score,
    s.dist_miles AS distance_miles,
    s.status,
    s.loads_today,
    CONCAT(
      CASE WHEN s.dist_miles IS NOT NULL THEN ROUND(s.dist_miles::numeric,1)::text || ' mi away · ' ELSE 'No GPS · ' END,
      CASE WHEN s.loads_today = 0 THEN 'Idle · ' ELSE s.loads_today::text || ' load(s) today · ' END,
      CASE WHEN s.loads_today = 0 THEN 'Light workload' ELSE 'Active' END
    ) AS reasoning
  FROM scored s
  ORDER BY (s.status_score + s.distance_score + s.workload_score) DESC
  LIMIT 10;
END;
$$;
