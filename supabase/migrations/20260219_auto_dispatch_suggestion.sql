-- ═══════════════════════════════════════════════════════════
-- Auto-Dispatch Suggestion v2 — RPC: get_driver_suggestion
-- Migration: 20260219_auto_dispatch_suggestion.sql
--
-- v2 improvements:
--   • Includes drivers with status 'available' OR 'on_delivery'
--   • ETA-aware scoring: estimates pickup ETA + 30-min delivery leg
--   • Cutoff enforcement: excludes drivers who cannot meet cutoff
--   • Cutoff margin bonus in score
-- ═══════════════════════════════════════════════════════════

-- Drop old signature (different param list) before replacing
DROP FUNCTION IF EXISTS get_driver_suggestion(UUID, FLOAT, FLOAT);

CREATE OR REPLACE FUNCTION get_driver_suggestion(
  p_load_id      UUID,
  p_pickup_lat   FLOAT,
  p_pickup_lng   FLOAT,
  p_cutoff_time  TIMESTAMPTZ DEFAULT NULL  -- NULL means no cutoff constraint
)
RETURNS TABLE (
  driver_id                    UUID,
  driver_name                  TEXT,
  distance_km                  FLOAT,
  active_loads_count           INT,
  eta_to_pickup_min            FLOAT,
  eta_to_delivery_min          FLOAT,
  estimated_arrival_at_delivery TIMESTAMPTZ,
  cutoff_margin_min            FLOAT,
  can_meet_cutoff              BOOLEAN,
  driver_status                TEXT,
  score                        FLOAT
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
      dl.latitude  AS last_lat,
      dl.longitude AS last_lng
    FROM driver_locations dl
    ORDER BY dl.driver_id, dl.recorded_at DESC
  ),

  -- Active shift per driver today (status = 'available' OR 'on_delivery')
  active_shifts AS (
    SELECT DISTINCT ON (ds.driver_id)
      ds.driver_id,
      ds.status AS shift_status
    FROM driver_shifts ds
    WHERE ds.status IN ('available', 'on_delivery')
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

  -- Core candidate set with haversine distance + ETA calculations
  candidates AS (
    SELECT
      d.id                                      AS driver_id,
      d.full_name                               AS driver_name,
      ash.shift_status                          AS driver_status,

      -- Haversine distance in km
      (
        6371.0 * 2.0 * ASIN(SQRT(
          POWER(SIN(RADIANS(ll.last_lat - p_pickup_lat) / 2.0), 2) +
          COS(RADIANS(p_pickup_lat)) * COS(RADIANS(ll.last_lat)) *
          POWER(SIN(RADIANS(ll.last_lng - p_pickup_lng) / 2.0), 2)
        ))
      )::FLOAT                                  AS distance_km,

      COALESCE(dlc.active_loads, 0)::INT        AS active_loads_count

    FROM drivers d
    INNER JOIN active_shifts ash ON ash.driver_id = d.id
    INNER JOIN latest_locations ll ON ll.driver_id = d.id
    LEFT  JOIN driver_load_counts dlc ON dlc.driver_id = d.id

    -- Exclude already-assigned driver
    WHERE (
      p_load_id IS NULL
      OR d.id NOT IN (
        SELECT COALESCE(dl2.driver_id, '00000000-0000-0000-0000-000000000000'::UUID)
        FROM daily_loads dl2
        WHERE dl2.id = p_load_id AND dl2.driver_id IS NOT NULL
      )
    )
  ),

  -- Compute ETA fields and cutoff logic
  scored AS (
    SELECT
      c.driver_id,
      c.driver_name,
      c.distance_km,
      c.active_loads_count,
      c.driver_status,

      -- ETA to pickup: on_delivery adds 15-min buffer
      (
        (c.distance_km / 40.0) * 60.0
        + CASE WHEN c.driver_status = 'on_delivery' THEN 15.0 ELSE 0.0 END
      )::FLOAT                                                  AS eta_to_pickup_min,

      -- Fixed 30-min delivery leg (conservative default)
      30.0::FLOAT                                               AS eta_to_delivery_min,

      -- Estimated arrival at delivery
      (
        NOW()
        + make_interval(mins => (
            (c.distance_km / 40.0) * 60.0
            + CASE WHEN c.driver_status = 'on_delivery' THEN 15.0 ELSE 0.0 END
            + 30.0
          )::INT
        )
      )::TIMESTAMPTZ                                            AS estimated_arrival_at_delivery,

      -- Cutoff margin (NULL if no cutoff provided)
      CASE
        WHEN p_cutoff_time IS NULL THEN NULL::FLOAT
        ELSE EXTRACT(EPOCH FROM (
          p_cutoff_time - (
            NOW()
            + make_interval(mins => (
                (c.distance_km / 40.0) * 60.0
                + CASE WHEN c.driver_status = 'on_delivery' THEN 15.0 ELSE 0.0 END
                + 30.0
              )::INT
            )
          )
        )) / 60.0
      END::FLOAT                                                AS cutoff_margin_min,

      -- Can meet cutoff?
      CASE
        WHEN p_cutoff_time IS NULL THEN TRUE
        WHEN (
          NOW()
          + make_interval(mins => (
              (c.distance_km / 40.0) * 60.0
              + CASE WHEN c.driver_status = 'on_delivery' THEN 15.0 ELSE 0.0 END
              + 30.0
            )::INT
          )
        ) < p_cutoff_time THEN TRUE
        ELSE FALSE
      END                                                       AS can_meet_cutoff

    FROM candidates c
  )

  SELECT
    s.driver_id,
    s.driver_name,
    s.distance_km,
    s.active_loads_count,
    s.eta_to_pickup_min,
    s.eta_to_delivery_min,
    s.estimated_arrival_at_delivery,
    s.cutoff_margin_min,
    s.can_meet_cutoff,
    s.driver_status,

    -- Score (LOWER = better)
    -- Base: distance penalty + active load penalty
    -- Bonus: subtract 10 if cutoff margin > 60 min (plenty of time)
    (
      (s.distance_km * 10.0)
      + (s.active_loads_count * 20.0)
      - CASE WHEN s.cutoff_margin_min IS NOT NULL AND s.cutoff_margin_min > 60.0 THEN 10.0 ELSE 0.0 END
    )::FLOAT                                                    AS score

  FROM scored s

  -- Exclude drivers who cannot meet cutoff
  WHERE s.can_meet_cutoff = TRUE

  ORDER BY score ASC
  LIMIT 3;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION get_driver_suggestion(UUID, FLOAT, FLOAT, TIMESTAMPTZ) TO authenticated;
