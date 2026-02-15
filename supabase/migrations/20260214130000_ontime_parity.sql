-- ═══════════════════════════════════════════════════════════
-- Migration: OnTime 360 Field Parity + Blast System Update
-- Anika Control OS — Phase 1 Blueprint
-- ═══════════════════════════════════════════════════════════

-- ────────────────────────────────────────────────
-- 1. Add OnTime-parity fields to daily_loads
-- ────────────────────────────────────────────────

-- Shipper / Client details
ALTER TABLE daily_loads ADD COLUMN IF NOT EXISTS shipper_name TEXT;
ALTER TABLE daily_loads ADD COLUMN IF NOT EXISTS requested_by TEXT;

-- Location company names (e.g., "UNICAL AVIATION", "AMERICAN AIRLINES CARGO")
ALTER TABLE daily_loads ADD COLUMN IF NOT EXISTS pickup_company TEXT;
ALTER TABLE daily_loads ADD COLUMN IF NOT EXISTS delivery_company TEXT;

-- Timing — collection and delivery windows
ALTER TABLE daily_loads ADD COLUMN IF NOT EXISTS collection_time TIMESTAMPTZ;
ALTER TABLE daily_loads ADD COLUMN IF NOT EXISTS delivery_time TIMESTAMPTZ;

-- Package / cargo details  
ALTER TABLE daily_loads ADD COLUMN IF NOT EXISTS description TEXT;           -- e.g., "CIVIL AIRCRAFT PART"
ALTER TABLE daily_loads ADD COLUMN IF NOT EXISTS dimensions_text TEXT;       -- e.g., "12 x 8 x 59 (L x W x H)"
ALTER TABLE daily_loads ADD COLUMN IF NOT EXISTS vehicle_required TEXT;      -- specific vehicle type needed

-- Tracking numbers
ALTER TABLE daily_loads ADD COLUMN IF NOT EXISTS po_number TEXT;             -- Purchase Order
ALTER TABLE daily_loads ADD COLUMN IF NOT EXISTS inbound_tracking TEXT;      -- Incoming tracking #
ALTER TABLE daily_loads ADD COLUMN IF NOT EXISTS outbound_tracking TEXT;     -- Outgoing tracking #

-- ETA tracking (for predictive alerts)
ALTER TABLE daily_loads ADD COLUMN IF NOT EXISTS estimated_pickup TIMESTAMPTZ;
ALTER TABLE daily_loads ADD COLUMN IF NOT EXISTS estimated_delivery TIMESTAMPTZ;
ALTER TABLE daily_loads ADD COLUMN IF NOT EXISTS actual_pickup TIMESTAMPTZ;
ALTER TABLE daily_loads ADD COLUMN IF NOT EXISTS actual_delivery TIMESTAMPTZ;
ALTER TABLE daily_loads ADD COLUMN IF NOT EXISTS current_eta TIMESTAMPTZ;
ALTER TABLE daily_loads ADD COLUMN IF NOT EXISTS eta_status TEXT DEFAULT 'unknown'
    CHECK (eta_status IN ('unknown', 'on_time', 'at_risk', 'late'));

-- SLA / deadline
ALTER TABLE daily_loads ADD COLUMN IF NOT EXISTS sla_deadline TIMESTAMPTZ;

-- Route data (from Google Maps)
ALTER TABLE daily_loads ADD COLUMN IF NOT EXISTS route_polyline TEXT;
ALTER TABLE daily_loads ADD COLUMN IF NOT EXISTS route_distance_meters INTEGER;
ALTER TABLE daily_loads ADD COLUMN IF NOT EXISTS route_duration_seconds INTEGER;

-- ────────────────────────────────────────────────
-- 2. Update blast_responses: "accepted" → "interested"
--    Dispatcher controls assignment, not auto-assign
-- ────────────────────────────────────────────────

-- Drop the old check constraint on blast_responses.status
ALTER TABLE blast_responses DROP CONSTRAINT IF EXISTS blast_responses_status_check;

-- Update any existing "accepted" responses to "interested" FIRST (before adding new constraint)
UPDATE blast_responses SET status = 'interested' WHERE status = 'accepted';

-- Now add new constraint with "interested" instead of "accepted"
ALTER TABLE blast_responses ADD CONSTRAINT blast_responses_status_check
    CHECK (status IN ('pending', 'viewed', 'interested', 'declined', 'expired'));

-- ────────────────────────────────────────────────
-- 3. Driver app support fields
-- ────────────────────────────────────────────────

ALTER TABLE drivers ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS device_token TEXT;              -- FCM token
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS notification_preference TEXT DEFAULT 'push'
    CHECK (notification_preference IN ('push', 'sms', 'both'));

-- Index for looking up driver by auth user
CREATE INDEX IF NOT EXISTS idx_drivers_user_id ON drivers(user_id) WHERE user_id IS NOT NULL;

-- ────────────────────────────────────────────────
-- 4. Route alerts table (predictive system)
-- ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS route_alerts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    load_id         UUID NOT NULL REFERENCES daily_loads(id) ON DELETE CASCADE,
    driver_id       UUID REFERENCES drivers(id) ON DELETE SET NULL,

    -- Alert classification
    alert_type      TEXT NOT NULL
                    CHECK (alert_type IN (
                        'eta_breach',       -- will miss delivery deadline
                        'idle_driver',      -- driver stopped unexpectedly
                        'route_deviation',  -- driver off expected path
                        'wait_time',        -- wait exceeds threshold
                        'detention',        -- detention-eligible
                        'late_pickup',      -- missed collection window
                        'unassigned'        -- load has no driver
                    )),
    severity        TEXT NOT NULL DEFAULT 'warning'
                    CHECK (severity IN ('info', 'warning', 'critical')),
    
    -- Alert content
    title           TEXT NOT NULL,
    message         TEXT,
    
    -- Resolution
    status          TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'acknowledged', 'resolved', 'dismissed')),
    acknowledged_by UUID REFERENCES auth.users(id),
    acknowledged_at TIMESTAMPTZ,
    resolved_at     TIMESTAMPTZ,

    -- Context
    metadata        JSONB DEFAULT '{}',       -- flexible context (ETA diff, GPS coords, etc.)

    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for route_alerts
CREATE INDEX IF NOT EXISTS idx_route_alerts_load ON route_alerts(load_id);
CREATE INDEX IF NOT EXISTS idx_route_alerts_active ON route_alerts(status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_route_alerts_type ON route_alerts(alert_type, severity);

-- RLS for route_alerts
ALTER TABLE route_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view all alerts"
    ON route_alerts FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can manage alerts"
    ON route_alerts FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Enable realtime for route_alerts
ALTER PUBLICATION supabase_realtime ADD TABLE route_alerts;

-- ────────────────────────────────────────────────
-- 5. Updated accept_blast → confirm_assignment
--    Dispatcher confirms, not auto-assign
-- ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION confirm_blast_assignment(
    p_blast_id UUID,
    p_driver_id UUID
)
RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE
    v_blast dispatch_blasts;
    v_load_id UUID;
BEGIN
    -- Lock the blast row
    SELECT * INTO v_blast FROM dispatch_blasts
    WHERE id = p_blast_id FOR UPDATE;

    IF v_blast IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Blast not found');
    END IF;

    IF v_blast.status != 'active' THEN
        RETURN jsonb_build_object('success', false, 'error',
            'Blast already ' || v_blast.status);
    END IF;

    -- Mark blast as accepted (dispatcher confirmed)
    UPDATE dispatch_blasts
    SET status = 'accepted',
        accepted_by = p_driver_id,
        accepted_at = now(),
        updated_at = now()
    WHERE id = p_blast_id;

    -- Update the chosen driver's response
    UPDATE blast_responses
    SET status = 'interested',  -- they expressed interest and were chosen
        responded_at = COALESCE(responded_at, now()),
        response_time_ms = COALESCE(response_time_ms,
            EXTRACT(EPOCH FROM (now() - notified_at))::INTEGER * 1000)
    WHERE blast_id = p_blast_id AND driver_id = p_driver_id;

    -- Expire all other pending/interested responses
    UPDATE blast_responses
    SET status = 'expired'
    WHERE blast_id = p_blast_id
      AND driver_id != p_driver_id
      AND status IN ('pending', 'viewed', 'interested');

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

-- ────────────────────────────────────────────────
-- 6. Auto-rollover function for undelivered loads
-- ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION rollover_undelivered_loads(p_from_date DATE DEFAULT CURRENT_DATE)
RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE
    v_count INTEGER;
BEGIN
    UPDATE daily_loads
    SET load_date = p_from_date + 1,
        updated_at = now()
    WHERE load_date = p_from_date
      AND status NOT IN ('delivered', 'cancelled')
      AND end_time IS NULL;

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

-- ────────────────────────────────────────────────
-- 7. Wait time alert trigger
--    Auto-creates route_alerts at 15min and 30min
-- ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION check_wait_time_alerts()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    -- Alert at 15 minutes
    IF NEW.wait_time_minutes >= 15 AND OLD.wait_time_minutes < 15 THEN
        -- Guard: skip if an active wait_time alert already exists for this load
        IF NOT EXISTS (
            SELECT 1 FROM route_alerts
            WHERE load_id = NEW.id AND alert_type = 'wait_time' AND status = 'active'
        ) THEN
            INSERT INTO route_alerts (load_id, driver_id, alert_type, severity, title, message)
            VALUES (
                NEW.id, NEW.driver_id, 'wait_time', 'warning',
                'Wait time: ' || NEW.wait_time_minutes || ' minutes',
                COALESCE(NEW.client_name, 'Unknown') || ' — ' || COALESCE(NEW.reference_number, 'No ref')
            );
        END IF;
    END IF;

    -- Detention at 30 minutes
    IF NEW.wait_time_minutes >= 30 AND OLD.wait_time_minutes < 30 THEN
        -- Update load detention eligibility
        UPDATE daily_loads SET detention_eligible = true WHERE id = NEW.id;

        -- Guard: skip if an active detention alert already exists for this load
        IF NOT EXISTS (
            SELECT 1 FROM route_alerts
            WHERE load_id = NEW.id AND alert_type = 'detention' AND status = 'active'
        ) THEN
            INSERT INTO route_alerts (load_id, driver_id, alert_type, severity, title, message)
            VALUES (
                NEW.id, NEW.driver_id, 'detention', 'critical',
                'DETENTION: ' || NEW.wait_time_minutes || ' minutes',
                COALESCE(NEW.client_name, 'Unknown') || ' — eligible for detention billing'
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

-- Attach trigger
DROP TRIGGER IF EXISTS trg_wait_time_alerts ON daily_loads;
CREATE TRIGGER trg_wait_time_alerts
    AFTER UPDATE OF wait_time_minutes ON daily_loads
    FOR EACH ROW
    EXECUTE FUNCTION check_wait_time_alerts();
