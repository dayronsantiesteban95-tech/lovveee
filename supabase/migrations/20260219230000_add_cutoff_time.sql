ALTER TABLE daily_loads ADD COLUMN IF NOT EXISTS cutoff_time timestamptz DEFAULT NULL;
