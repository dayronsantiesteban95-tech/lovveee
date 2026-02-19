-- ═══════════════════════════════════════════════════════════
-- Auto-Dispatch Suggestion — RPC: get_driver_suggestion
-- Migration: 20260219_auto_dispatch_suggestion.sql
-- Scores available drivers for a given load pickup location.
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION get_driver_suggestion(
  p_load_id    UUID,
  p_pickup_lat FLOAT,
  p_pickup_lng FLOAT
)
RETURNS TABLE (
  driver_id          UUID,
  driver_name        TEXT,
  distance_km        FLOAT,
  active_loads_count INT,
  shift_hours        FLOAT,
  score              FLOAT,
  last_lat           FLOAT,
  last_lng           FLOAT
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_today DATE := CURRENT_DATE;
BEGIN
  RETURN QUERY
  WITH

  -- Latest GPS location per driver
  latest_locations AS (
    SELECT DISTINCT ON (dl.driver_id)
      dl.driver_id,
      dl.latitude,
      dl.longitude
    FROM driver_locations dl
    ORDER BY dl.driver_id, dl.recorded_at DESC
  ),

  -- Active shift per driver today (status = 'available')
  active_shifts AS (
    SELECT DISTINCT ON (ds.driver_id)
      ds.driver_id,
      ds.shift_start
    FROM driver_shifts ds
    WHERE ds.status = 'available'
      AND ds.shift_start::DATE = v_today
      AND ds.shift_end IS NULL
    ORDER BY ds.driver_id, ds.shift_start DESC
  ),

  -- Active loads count per driver today
  driver_load_counts AS (
    SELECT
      dld.driver_id,
      COUNT(*)::INT AS active_loads
    FROM daily_loads dld
    WHERE dld.load_date = v_today
      AND dld.driver_id IS NOT NULL
      AND dld.status NOT IN ('delivered', 'cancelled')
    GROUP BY dld.driver_id
  ),

  -- Shift hours from time_entries (today, clocked-in)
  driver_shift_hours AS (
    SELECT
      te.driver_id,
      COALESCE(
        SUM(
          EXTRACT(EPOCH FROM (COALESCE(te.clock_out, NOW()) - te.clock_in)) / 3600.0
        ),
        0
      )::FLOAT AS hours_today
    FROM time_entries te
    WHERE te.work_date = v_today
    GROUP BY te.driver_id
  )

  SELECT
    d.id                                          AS driver_id,
    d.full_name                                   AS driver_name,

    -- Haversine distance in km
    (
      2 * 6371.0 *
      ASIN(
        SQRT(
          POWER(SIN((RADIANS(ll.latitude) - RADIANS(p_pickup_lat)) / 2), 2) +
          COS(RADIANS(p_pickup_lat)) *
          COS(RADIANS(ll.latitude)) *
          POWER(SIN((RADIANS(ll.longitude) - RADIANS(p_pickup_lng)) / 2), 2)
        )
      )
    )::FLOAT                                      AS distance_km,

    COALESCE(dlc.active_loads, 0)::INT            AS active_loads_count,
    COALESCE(dsh.hours_today, 0.0)::FLOAT         AS shift_hours,

    -- score = (distance_km * 10) + (active_loads * 20) + (shift_hours > 8 ? 30 : 0)
    (
      (
        2 * 6371.0 *
        ASIN(
          SQRT(
            POWER(SIN((RADIANS(ll.latitude) - RADIANS(p_pickup_lat)) / 2), 2) +
            COS(RADIANS(p_pickup_lat)) *
            COS(RADIANS(ll.latitude)) *
            POWER(SIN((RADIANS(ll.longitude) - RADIANS(p_pickup_lng)) / 2), 2)
          )
        )
      ) * 10.0
      + COALESCE(dlc.active_loads, 0) * 20.0
      + CASE WHEN COALESCE(dsh.hours_today, 0.0) > 8 THEN 30.0 ELSE 0.0 END
    )::FLOAT                                      AS score,

    ll.latitude::FLOAT                            AS last_lat,
    ll.longitude::FLOAT                           AS last_lng

  FROM drivers d
  -- Must have an active shift with status = 'available'
  INNER JOIN active_shifts ash ON ash.driver_id = d.id
  -- Must have a GPS location on record
  INNER JOIN latest_locations ll ON ll.driver_id = d.id

  -- Optional joins
  LEFT JOIN driver_load_counts dlc ON dlc.driver_id = d.id
  LEFT JOIN driver_shift_hours dsh ON dsh.driver_id = d.id

  -- Don't suggest the driver already assigned
  WHERE (p_load_id IS NULL OR d.id NOT IN (
    SELECT COALESCE(dl2.driver_id, '00000000-0000-0000-0000-000000000000'::UUID)
    FROM daily_loads dl2
    WHERE dl2.id = p_load_id AND dl2.driver_id IS NOT NULL
  ))

  ORDER BY score ASC
  LIMIT 3;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION get_driver_suggestion(UUID, FLOAT, FLOAT) TO authenticated;
