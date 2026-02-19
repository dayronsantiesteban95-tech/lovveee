-- ═══════════════════════════════════════════════════════════════════════════
-- Performance Indexes — Scale to 100 loads/day + 20 live drivers
-- These complement existing indexes (idx_driver_locations_driver_latest, etc.)
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── daily_loads: load board queries (filter by date, status, hub) ───────────
CREATE INDEX IF NOT EXISTS idx_daily_loads_created_at
    ON daily_loads(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_daily_loads_status
    ON daily_loads(status);

CREATE INDEX IF NOT EXISTS idx_daily_loads_driver_id
    ON daily_loads(driver_id);

CREATE INDEX IF NOT EXISTS idx_daily_loads_hub
    ON daily_loads(hub);

-- Composite: date + status (most common load board filter)
CREATE INDEX IF NOT EXISTS idx_daily_loads_date_status
    ON daily_loads(created_at DESC, status);

-- Composite: driver + status (driver's active loads)
CREATE INDEX IF NOT EXISTS idx_daily_loads_driver_status
    ON daily_loads(driver_id, status);

-- ─── driver_locations: GPS queries (critical for real-time map) ───────────────
-- Note: idx_driver_locations_driver_latest already exists from migration 005
-- These add individual column indexes for flexibility + range queries

CREATE INDEX IF NOT EXISTS idx_driver_locations_driver_id
    ON driver_locations(driver_id);

CREATE INDEX IF NOT EXISTS idx_driver_locations_recorded_at
    ON driver_locations(recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_driver_locations_driver_recorded
    ON driver_locations(driver_id, recorded_at DESC);

-- ─── invoices ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_invoices_created_at
    ON invoices(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_invoices_status
    ON invoices(status);

-- ─── load_status_events: timeline / audit trail queries ─────────────────────
-- Note: idx_load_events_load already exists from migration 005
CREATE INDEX IF NOT EXISTS idx_load_status_events_load_id
    ON load_status_events(load_id);

CREATE INDEX IF NOT EXISTS idx_load_status_events_created_at
    ON load_status_events(created_at DESC);

-- ─── load_messages: in-load chat ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_load_messages_load_id
    ON load_messages(load_id);

CREATE INDEX IF NOT EXISTS idx_load_messages_created_at
    ON load_messages(created_at DESC);
