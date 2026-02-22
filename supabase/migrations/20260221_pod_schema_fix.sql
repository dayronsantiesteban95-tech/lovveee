-- ──────────────────────────────────────────────────────────────
-- Fix pod_submissions schema mismatch
-- The driver app sends signer_name and signed_at but these
-- columns were missing from the table. Without them, every
-- POD submission throws a "column does not exist" SQL error.
-- ──────────────────────────────────────────────────────────────

ALTER TABLE pod_submissions
  ADD COLUMN IF NOT EXISTS signer_name TEXT,
  ADD COLUMN IF NOT EXISTS signed_at TIMESTAMPTZ;

-- Also ensure the storage bucket comment is documented
-- NOTE: The 'pod-photos' bucket must be created manually in
-- the Supabase Dashboard > Storage > New Bucket:
--   Name: pod-photos
--   Public: Yes
--   Allowed MIME types: image/jpeg, image/png, image/webp
