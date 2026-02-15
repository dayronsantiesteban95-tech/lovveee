-- ══════════════════════════════════════════════════════════════
-- POD MANAGER — Proof of Delivery & Load Documents
-- Enables dispatchers to upload load documents (BOL, instructions)
-- and drivers to submit proof of delivery (photos, signatures, notes).
-- ══════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────
-- 1. Load Documents — uploaded by dispatchers
-- ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS load_documents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  load_id         UUID NOT NULL REFERENCES daily_loads(id) ON DELETE CASCADE,
  document_type   TEXT NOT NULL DEFAULT 'bol',   -- bol, delivery_instructions, rate_confirmation, customs, other
  file_name       TEXT NOT NULL,
  file_path       TEXT NOT NULL,                  -- Supabase storage path
  file_size_bytes INTEGER DEFAULT 0,
  mime_type       TEXT,
  notes           TEXT,
  uploaded_by     UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ──────────────────────────────────────────────────
-- 2. Proof of Delivery — submitted by drivers
-- ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS proof_of_delivery (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  load_id           UUID NOT NULL REFERENCES daily_loads(id) ON DELETE CASCADE,

  -- POD content
  photo_paths       TEXT[] DEFAULT '{}',            -- array of storage paths for photos
  signature_path    TEXT,                            -- storage path for e-signature image
  recipient_name    TEXT,                            -- who signed for it
  delivery_notes    TEXT,                            -- driver notes about the delivery
  delivery_time     TIMESTAMPTZ DEFAULT now(),       -- actual delivery timestamp

  -- Status tracking
  status            TEXT NOT NULL DEFAULT 'pending', -- pending, submitted, verified, rejected
  verified_by       UUID REFERENCES auth.users(id),
  verified_at       TIMESTAMPTZ,
  rejection_reason  TEXT,

  -- Geolocation (optional — for future GPS verification)
  delivery_lat      NUMERIC(10,7),
  delivery_lng      NUMERIC(10,7),

  -- Metadata
  submitted_by      UUID REFERENCES auth.users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ──────────────────────────────────────────────────
-- 3. RLS Policies
-- ──────────────────────────────────────────────────
ALTER TABLE load_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE proof_of_delivery ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_load_docs_select"  ON load_documents  FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_load_docs_insert"  ON load_documents  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_load_docs_update"  ON load_documents  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_load_docs_delete"  ON load_documents  FOR DELETE TO authenticated USING (true);

CREATE POLICY "auth_pod_select"  ON proof_of_delivery  FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_pod_insert"  ON proof_of_delivery  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_pod_update"  ON proof_of_delivery  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_pod_delete"  ON proof_of_delivery  FOR DELETE TO authenticated USING (true);

-- ──────────────────────────────────────────────────
-- 4. Indexes
-- ──────────────────────────────────────────────────
CREATE INDEX idx_load_documents_load      ON load_documents(load_id);
CREATE INDEX idx_load_documents_type      ON load_documents(document_type);
CREATE INDEX idx_pod_load                 ON proof_of_delivery(load_id);
CREATE INDEX idx_pod_status               ON proof_of_delivery(status);
CREATE INDEX idx_pod_submitted_by         ON proof_of_delivery(submitted_by);

-- ──────────────────────────────────────────────────
-- 5. Storage bucket for POD files
--    Run this via Supabase dashboard or API:
--    INSERT INTO storage.buckets (id, name, public)
--    VALUES ('pod-files', 'pod-files', true);
-- ──────────────────────────────────────────────────
-- Note: Storage bucket + policies need to be created
-- through the Supabase dashboard (Storage > New bucket)
-- Bucket name: pod-files
-- Public: Yes (for easy image display)
-- Allowed MIME: image/*, application/pdf
