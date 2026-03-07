-- ============================================================
-- Client Portal Tokens - 2026-03-07
-- One token per client company. Gives access to all their loads.
-- Public tracking portal at /portal/:token
-- ============================================================

CREATE TABLE IF NOT EXISTS client_portal_tokens (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name   TEXT NOT NULL,
  portal_token  TEXT UNIQUE NOT NULL DEFAULT '',
  created_by    UUID REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_accessed TIMESTAMPTZ,
  is_active     BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_client_portal_tokens_token ON client_portal_tokens(portal_token);
CREATE INDEX IF NOT EXISTS idx_client_portal_tokens_client ON client_portal_tokens(client_name);

-- Auto-generate portal token on insert
CREATE OR REPLACE FUNCTION generate_portal_token()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  v_token TEXT := 'CPT-';
  v_i INT;
BEGIN
  IF NEW.portal_token IS NULL OR NEW.portal_token = '' THEN
    FOR v_i IN 1..16 LOOP
      v_token := v_token || substr(v_chars, floor(random() * 36 + 1)::int, 1);
    END LOOP;
    NEW.portal_token := v_token;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_client_portal_token
  BEFORE INSERT ON client_portal_tokens
  FOR EACH ROW EXECUTE FUNCTION generate_portal_token();

-- RLS: authenticated users can manage; anon can read active tokens (needed for portal page RPC)
ALTER TABLE client_portal_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_portal_tokens_all" ON client_portal_tokens
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "anon_portal_tokens_select" ON client_portal_tokens
  FOR SELECT TO anon
  USING (is_active = true);

-- ============================================================
-- Public RPC: get loads for a client portal token (no auth required)
-- ============================================================
CREATE OR REPLACE FUNCTION get_client_portal_loads(p_token TEXT)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_client_name TEXT;
  v_portal_id   UUID;
  result        json;
BEGIN
  -- Look up the token
  SELECT id, client_name
  INTO v_portal_id, v_client_name
  FROM client_portal_tokens
  WHERE portal_token = p_token AND is_active = true;

  IF v_client_name IS NULL THEN
    RETURN json_build_object('found', false, 'error', 'Invalid or expired portal link');
  END IF;

  -- Update last_accessed
  UPDATE client_portal_tokens SET last_accessed = now() WHERE id = v_portal_id;

  -- Return loads for this client (last 60 days, non-cancelled)
  SELECT json_build_object(
    'found', true,
    'client_name', v_client_name,
    'portal_token', p_token,
    'loads', COALESCE((
      SELECT json_agg(
        json_build_object(
          'id',               dl.id,
          'reference_number', dl.reference_number,
          'tracking_token',   dl.tracking_token,
          'status',           dl.status,
          'service_type',     dl.service_type,
          'packages',         dl.packages,
          'pickup_address',   dl.pickup_address,
          'delivery_address', dl.delivery_address,
          'load_date',        dl.load_date,
          'start_time',       dl.start_time,
          'end_time',         dl.end_time,
          'estimated_arrival',dl.estimated_delivery,
          'pod_confirmed',    dl.pod_confirmed,
          'driver_name',      d.full_name,
          'hub',              dl.hub
        ) ORDER BY dl.load_date DESC, dl.created_at DESC
      )
      FROM daily_loads dl
      LEFT JOIN drivers d ON d.id = dl.driver_id
      WHERE dl.client_name ILIKE v_client_name
        AND dl.load_date >= CURRENT_DATE - INTERVAL '60 days'
        AND dl.status != 'cancelled'
    ), '[]'::json)
  ) INTO result;

  RETURN result;
END;
$$;

-- Allow anon role to call the portal RPC
GRANT EXECUTE ON FUNCTION get_client_portal_loads(TEXT) TO anon;
