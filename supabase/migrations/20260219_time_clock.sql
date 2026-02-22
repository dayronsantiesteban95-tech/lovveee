-- ═══════════════════════════════════════════════════════════════
-- Time Clock Module — Anika Control OS
-- Migration: 20260219_time_clock.sql
-- Created by: Jarvis (overnight work — Feb 19, 2026)
-- ═══════════════════════════════════════════════════════════════

-- ─── Table: time_entries ────────────────────────────────────────
-- Core time clock records per driver per shift
CREATE TABLE IF NOT EXISTS time_entries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id       UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,

  -- Clock state
  clock_in        TIMESTAMPTZ NOT NULL,
  clock_out       TIMESTAMPTZ,                        -- NULL = currently clocked in
  break_minutes   INTEGER NOT NULL DEFAULT 0,         -- cumulative break time in minutes

  -- Classification
  hub             TEXT NOT NULL DEFAULT 'PHX',        -- PHX | ATL | LA
  shift           TEXT NOT NULL DEFAULT 'day',        -- day | night | weekend
  work_date       DATE NOT NULL DEFAULT CURRENT_DATE, -- which calendar day

  -- Computed (denorm for fast reporting — update on clock_out)
  total_minutes   INTEGER,                            -- clock_out - clock_in - break_minutes
  regular_hours   NUMERIC(5,2),                       -- up to 8h
  overtime_hours  NUMERIC(5,2),                       -- >8h
  total_pay       NUMERIC(10,2),                      -- hours * driver hourly_rate

  -- Notes / audit
  notes           TEXT,
  created_by      UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Table: time_breaks ─────────────────────────────────────────
-- Tracks individual break periods within a shift
CREATE TABLE IF NOT EXISTS time_breaks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  time_entry_id   UUID NOT NULL REFERENCES time_entries(id) ON DELETE CASCADE,
  driver_id       UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  break_start     TIMESTAMPTZ NOT NULL,
  break_end       TIMESTAMPTZ,                        -- NULL = currently on break
  break_minutes   INTEGER,                            -- filled on break_end
  break_type      TEXT NOT NULL DEFAULT 'break',      -- break | lunch
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Indexes ────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_time_entries_driver_id  ON time_entries(driver_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_work_date  ON time_entries(work_date DESC);
CREATE INDEX IF NOT EXISTS idx_time_entries_hub        ON time_entries(hub);
CREATE INDEX IF NOT EXISTS idx_time_entries_clock_out  ON time_entries(clock_out) WHERE clock_out IS NULL;
CREATE INDEX IF NOT EXISTS idx_time_breaks_entry_id    ON time_breaks(time_entry_id);
CREATE INDEX IF NOT EXISTS idx_time_breaks_driver_id   ON time_breaks(driver_id);

-- ─── RLS ────────────────────────────────────────────────────────
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_breaks  ENABLE ROW LEVEL SECURITY;

-- Owners + dispatchers can see all entries
CREATE POLICY "time_entries_read" ON time_entries
  FOR SELECT USING (true);

CREATE POLICY "time_entries_insert" ON time_entries
  FOR INSERT WITH CHECK (true);

CREATE POLICY "time_entries_update" ON time_entries
  FOR UPDATE USING (true);

CREATE POLICY "time_breaks_read" ON time_breaks
  FOR SELECT USING (true);

CREATE POLICY "time_breaks_insert" ON time_breaks
  FOR INSERT WITH CHECK (true);

CREATE POLICY "time_breaks_update" ON time_breaks
  FOR UPDATE USING (true);

-- ─── Helper: auto-update updated_at ─────────────────────────────
CREATE OR REPLACE FUNCTION update_time_entry_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER time_entries_updated_at
  BEFORE UPDATE ON time_entries
  FOR EACH ROW EXECUTE FUNCTION update_time_entry_updated_at();

-- ─── RPC: clock_in_driver ────────────────────────────────────────
-- Called when dispatcher clicks "Clock In" for a driver.
-- Returns the new time_entry id.
CREATE OR REPLACE FUNCTION clock_in_driver(
  p_driver_id   UUID,
  p_hub         TEXT DEFAULT 'PHX',
  p_shift       TEXT DEFAULT 'day',
  p_notes       TEXT DEFAULT NULL,
  p_created_by  UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql AS $$
DECLARE
  v_entry_id UUID;
  v_existing UUID;
BEGIN
  -- Guard: check driver not already clocked in
  SELECT id INTO v_existing
  FROM time_entries
  WHERE driver_id = p_driver_id
    AND clock_out IS NULL
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RAISE EXCEPTION 'Driver is already clocked in (entry: %)', v_existing;
  END IF;

  INSERT INTO time_entries (driver_id, clock_in, hub, shift, work_date, notes, created_by)
  VALUES (p_driver_id, NOW(), p_hub, p_shift, CURRENT_DATE, p_notes, p_created_by)
  RETURNING id INTO v_entry_id;

  RETURN v_entry_id;
END;
$$;

-- ─── RPC: clock_out_driver ───────────────────────────────────────
-- Called when dispatcher clicks "Clock Out".
-- Computes totals, handles OT, updates entry in-place.
CREATE OR REPLACE FUNCTION clock_out_driver(
  p_entry_id    UUID,
  p_notes       TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql AS $$
DECLARE
  v_entry         time_entries%ROWTYPE;
  v_driver        drivers%ROWTYPE;
  v_total_min     INTEGER;
  v_work_min      INTEGER;
  v_reg_hours     NUMERIC(5,2);
  v_ot_hours      NUMERIC(5,2);
  v_total_break   INTEGER;
  v_pay           NUMERIC(10,2);
BEGIN
  SELECT * INTO v_entry FROM time_entries WHERE id = p_entry_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Time entry % not found', p_entry_id; END IF;
  IF v_entry.clock_out IS NOT NULL THEN RAISE EXCEPTION 'Driver already clocked out'; END IF;

  SELECT * INTO v_driver FROM drivers WHERE id = v_entry.driver_id;

  -- Sum break time from time_breaks table
  SELECT COALESCE(SUM(break_minutes), 0) INTO v_total_break
  FROM time_breaks
  WHERE time_entry_id = p_entry_id AND break_end IS NOT NULL;

  -- Total time on site
  v_total_min := EXTRACT(EPOCH FROM (NOW() - v_entry.clock_in))::INTEGER / 60;
  -- Actual work time (minus breaks)
  v_work_min  := GREATEST(v_total_min - v_total_break, 0);
  -- OT threshold: 480 minutes = 8 hours
  v_reg_hours := LEAST(v_work_min::NUMERIC / 60, 8);
  v_ot_hours  := GREATEST((v_work_min::NUMERIC / 60) - 8, 0);
  -- Pay: reg at 1x, OT at 1.5x
  v_pay := (v_reg_hours * v_driver.hourly_rate) + (v_ot_hours * v_driver.hourly_rate * 1.5);

  UPDATE time_entries SET
    clock_out      = NOW(),
    break_minutes  = v_total_break,
    total_minutes  = v_work_min,
    regular_hours  = v_reg_hours,
    overtime_hours = v_ot_hours,
    total_pay      = v_pay,
    notes          = COALESCE(p_notes, notes)
  WHERE id = p_entry_id;

  RETURN jsonb_build_object(
    'entry_id',       p_entry_id,
    'total_minutes',  v_work_min,
    'regular_hours',  v_reg_hours,
    'overtime_hours', v_ot_hours,
    'break_minutes',  v_total_break,
    'total_pay',      v_pay,
    'hourly_rate',    v_driver.hourly_rate
  );
END;
$$;

-- ─── RPC: start_break ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION start_break(
  p_entry_id  UUID,
  p_driver_id UUID,
  p_type      TEXT DEFAULT 'break'
)
RETURNS UUID
LANGUAGE plpgsql AS $$
DECLARE
  v_break_id UUID;
  v_existing UUID;
BEGIN
  -- Guard: check driver does not already have an active break on this entry
  SELECT id INTO v_existing
  FROM time_breaks
  WHERE time_entry_id = p_entry_id
    AND break_end IS NULL
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RAISE EXCEPTION 'Driver already has an active break (break: %)', v_existing;
  END IF;

  INSERT INTO time_breaks (time_entry_id, driver_id, break_start, break_type)
  VALUES (p_entry_id, p_driver_id, NOW(), p_type)
  RETURNING id INTO v_break_id;
  RETURN v_break_id;
END;
$$;

-- ─── RPC: end_break ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION end_break(
  p_break_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql AS $$
DECLARE v_minutes INTEGER;
BEGIN
  UPDATE time_breaks
  SET break_end     = NOW(),
      break_minutes = EXTRACT(EPOCH FROM (NOW() - break_start))::INTEGER / 60
  WHERE id = p_break_id AND break_end IS NULL
  RETURNING break_minutes INTO v_minutes;
  RETURN v_minutes;
END;
$$;

-- ─── View: v_active_clocks ───────────────────────────────────────
-- Live view of who's currently clocked in — used by dashboard
CREATE OR REPLACE VIEW v_active_clocks AS
SELECT
  te.id               AS entry_id,
  te.driver_id,
  d.full_name         AS driver_name,
  d.hourly_rate,
  d.hub               AS driver_hub,
  te.hub,
  te.shift,
  te.clock_in,
  te.work_date,
  EXTRACT(EPOCH FROM (NOW() - te.clock_in))::INTEGER / 60  AS elapsed_minutes,
  (
    SELECT COUNT(*) FROM time_breaks tb
    WHERE tb.time_entry_id = te.id AND tb.break_end IS NULL
  ) > 0               AS on_break,
  (
    SELECT tb.id FROM time_breaks tb
    WHERE tb.time_entry_id = te.id AND tb.break_end IS NULL
    LIMIT 1
  )                   AS active_break_id
FROM time_entries te
JOIN drivers d ON d.id = te.driver_id
WHERE te.clock_out IS NULL;

-- ─── View: v_payroll_summary ─────────────────────────────────────
-- Weekly payroll roll-up — driver × week
CREATE OR REPLACE VIEW v_payroll_summary AS
SELECT
  te.driver_id,
  d.full_name,
  d.hourly_rate,
  te.hub,
  DATE_TRUNC('week', te.work_date) AS week_start,
  COUNT(te.id)                      AS shifts,
  SUM(te.total_minutes)             AS total_work_minutes,
  SUM(te.regular_hours)             AS total_regular_hours,
  SUM(te.overtime_hours)            AS total_overtime_hours,
  SUM(te.total_pay)                 AS total_pay,
  SUM(te.break_minutes)             AS total_break_minutes
FROM time_entries te
JOIN drivers d ON d.id = te.driver_id
WHERE te.clock_out IS NOT NULL
GROUP BY te.driver_id, d.full_name, d.hourly_rate, te.hub, DATE_TRUNC('week', te.work_date)
ORDER BY week_start DESC, total_pay DESC;
