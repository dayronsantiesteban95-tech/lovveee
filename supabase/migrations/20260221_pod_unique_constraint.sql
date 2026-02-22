-- ----------------------------------------------------------------
-- Prevent duplicate POD submissions per load per driver per day
-- If a driver accidentally double-taps submit, only one record is created
-- ----------------------------------------------------------------

-- Add a unique index on (load_id, driver_id, date of captured_at)
-- This allows multiple POD submissions per driver per load on different days
-- (e.g., if a delivery spans multiple days or requires re-submission)
CREATE UNIQUE INDEX IF NOT EXISTS idx_pod_submissions_unique_per_day
    ON pod_submissions (load_id, driver_id, (captured_at::date));
