-- ══════════════════════════════════════════════════════════════
-- DISPATCH BLAST SYSTEM — Phase 1
-- Broadcast available loads to multiple drivers simultaneously.
-- First driver to accept claims the load (Uber-style).
-- ══════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────
-- 1. Dispatch Blasts — one row per blast event
-- ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS dispatch_blasts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  load_id         UUID NOT NULL REFERENCES daily_loads(id) ON DELETE CASCADE,
  created_by      UUID NOT NULL REFERENCES auth.users(id),

  -- Blast config
  hub             TEXT NOT NULL DEFAULT 'phoenix',
  message         TEXT,                              -- custom message to drivers
  priority        TEXT NOT NULL DEFAULT 'normal'      -- low, normal, high, urgent
                  CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  radius_miles    INTEGER DEFAULT 50,                -- max distance from pickup

  -- Timing
  expires_at      TIMESTAMPTZ,                        -- auto-close after this time
  blast_sent_at   TIMESTAMPTZ DEFAULT now(),

  -- Resolution
  status          TEXT NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'accepted', 'expired', 'cancelled')),
  accepted_by     UUID REFERENCES drivers(id),
  accepted_at     TIMESTAMPTZ,
  
  -- Stats
  drivers_notified INTEGER DEFAULT 0,
  drivers_viewed   INTEGER DEFAULT 0,
  drivers_declined INTEGER DEFAULT 0,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ──────────────────────────────────────────────────
-- 2. Blast Responses — individual driver responses
-- ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS blast_responses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blast_id        UUID NOT NULL REFERENCES dispatch_blasts(id) ON DELETE CASCADE,
  driver_id       UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,

  -- Response
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'viewed', 'accepted', 'declined', 'expired')),
  response_time_ms INTEGER,                           -- ms from blast to response
  decline_reason  TEXT,                               -- optional reason for declining

  -- Driver location at time of response
  latitude        DOUBLE PRECISION,
  longitude       DOUBLE PRECISION,
  distance_miles  NUMERIC(6,1),                       -- distance to pickup

  notified_at     TIMESTAMPTZ DEFAULT now(),
  responded_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique: one response per driver per blast
CREATE UNIQUE INDEX idx_blast_response_unique
  ON blast_responses (blast_id, driver_id);

-- Fast lookup: active blasts for a driver
CREATE INDEX idx_blast_responses_driver_pending
  ON blast_responses (driver_id, status)
  WHERE status IN ('pending', 'viewed');

-- Fast lookup: blasts for a load
CREATE INDEX idx_dispatch_blasts_load
  ON dispatch_blasts (load_id);

-- Active blasts only
CREATE INDEX idx_dispatch_blasts_active
  ON dispatch_blasts (status, expires_at)
  WHERE status = 'active';

-- ──────────────────────────────────────────────────
-- 3. RLS Policies
-- ──────────────────────────────────────────────────
ALTER TABLE dispatch_blasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE blast_responses ENABLE ROW LEVEL SECURITY;

-- Dispatchers can manage blasts
CREATE POLICY blasts_select ON dispatch_blasts FOR SELECT TO authenticated USING (true);
CREATE POLICY blasts_insert ON dispatch_blasts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY blasts_update ON dispatch_blasts FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Responses: drivers can update their own, dispatchers can read all
CREATE POLICY responses_select ON blast_responses FOR SELECT TO authenticated USING (true);
CREATE POLICY responses_insert ON blast_responses FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY responses_update ON blast_responses FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ──────────────────────────────────────────────────
-- 4. Realtime: enable for live blast tracking
-- ──────────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE dispatch_blasts;
ALTER PUBLICATION supabase_realtime ADD TABLE blast_responses;

-- ──────────────────────────────────────────────────
-- 5. Function: Auto-expire blasts past their deadline
-- ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION expire_stale_blasts()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
    -- Expire blasts past their expiry
    UPDATE dispatch_blasts
    SET status = 'expired', updated_at = now()
    WHERE status = 'active'
      AND expires_at IS NOT NULL
      AND expires_at < now();

    -- Expire pending responses for expired/accepted blasts
    UPDATE blast_responses br
    SET status = 'expired', responded_at = now()
    FROM dispatch_blasts db
    WHERE br.blast_id = db.id
      AND br.status IN ('pending', 'viewed')
      AND db.status IN ('expired', 'accepted', 'cancelled');
END;
$$;

-- ──────────────────────────────────────────────────
-- 6. Function: Accept a blast (atomic — first wins)
-- ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION accept_blast(
    p_blast_id UUID,
    p_driver_id UUID,
    p_latitude DOUBLE PRECISION DEFAULT NULL,
    p_longitude DOUBLE PRECISION DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE
    v_blast dispatch_blasts;
    v_response blast_responses;
    v_load_id UUID;
BEGIN
    -- Lock the blast row to prevent race conditions
    SELECT * INTO v_blast FROM dispatch_blasts
    WHERE id = p_blast_id FOR UPDATE;

    IF v_blast IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Blast not found');
    END IF;

    IF v_blast.status != 'active' THEN
        RETURN jsonb_build_object('success', false, 'error',
            'Blast already ' || v_blast.status);
    END IF;

    IF v_blast.expires_at IS NOT NULL AND v_blast.expires_at < now() THEN
        UPDATE dispatch_blasts SET status = 'expired', updated_at = now()
        WHERE id = p_blast_id;
        RETURN jsonb_build_object('success', false, 'error', 'Blast has expired');
    END IF;

    -- Update the blast as accepted
    UPDATE dispatch_blasts
    SET status = 'accepted',
        accepted_by = p_driver_id,
        accepted_at = now(),
        updated_at = now()
    WHERE id = p_blast_id;

    -- Update the driver's response
    UPDATE blast_responses
    SET status = 'accepted',
        responded_at = now(),
        latitude = COALESCE(p_latitude, latitude),
        longitude = COALESCE(p_longitude, longitude),
        response_time_ms = EXTRACT(EPOCH FROM (now() - notified_at))::INTEGER * 1000
    WHERE blast_id = p_blast_id AND driver_id = p_driver_id;

    -- Expire all other pending responses
    UPDATE blast_responses
    SET status = 'expired', responded_at = now()
    WHERE blast_id = p_blast_id
      AND driver_id != p_driver_id
      AND status IN ('pending', 'viewed');

    -- Assign the driver to the load
    UPDATE daily_loads
    SET driver_id = p_driver_id,
        status = 'assigned',
        updated_at = now()
    WHERE id = v_blast.load_id;

    RETURN jsonb_build_object(
        'success', true,
        'load_id', v_blast.load_id,
        'driver_id', p_driver_id
    );
END;
$$;
