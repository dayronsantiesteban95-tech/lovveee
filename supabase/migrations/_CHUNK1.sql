-- CHUNK 1/3: RLS policies + POD schema + Load Messages table
-- APPLIED SUCCESSFULLY 2026-02-24

-- [1/8] Blast DELETE policies
DROP POLICY IF EXISTS blasts_delete ON dispatch_blasts;
CREATE POLICY blasts_delete ON dispatch_blasts
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'owner'));

DROP POLICY IF EXISTS responses_delete ON blast_responses;
CREATE POLICY responses_delete ON blast_responses
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'owner'));

-- [2/8] POD schema fix
ALTER TABLE pod_submissions
  ADD COLUMN IF NOT EXISTS signer_name TEXT,
  ADD COLUMN IF NOT EXISTS signed_at TIMESTAMPTZ;

-- [3/8] Load messages table + chat RPCs
CREATE TABLE IF NOT EXISTS load_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    load_id UUID NOT NULL REFERENCES daily_loads(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL,
    sender_name TEXT NOT NULL DEFAULT '',
    sender_role TEXT NOT NULL DEFAULT 'dispatcher' CHECK (sender_role IN ('dispatcher', 'driver')),
    message TEXT NOT NULL,
    read_by JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_load_messages_load_id ON load_messages (load_id);
CREATE INDEX IF NOT EXISTS idx_load_messages_created_at ON load_messages (created_at);

ALTER TABLE load_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS messages_select ON load_messages;
CREATE POLICY messages_select ON load_messages FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS messages_insert ON load_messages;
CREATE POLICY messages_insert ON load_messages FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS messages_update ON load_messages;
CREATE POLICY messages_update ON load_messages FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE load_messages;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION mark_messages_read(p_load_id UUID, p_user_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    UPDATE load_messages
    SET read_by = CASE
        WHEN read_by IS NULL THEN jsonb_build_array(p_user_id::text)
        WHEN NOT (read_by ? p_user_id::text) THEN read_by || jsonb_build_array(p_user_id::text)
        ELSE read_by
    END
    WHERE load_id = p_load_id AND sender_id != p_user_id
      AND (read_by IS NULL OR NOT (read_by ? p_user_id::text));
END;
$$;

CREATE OR REPLACE FUNCTION get_unread_message_counts(p_user_id UUID)
RETURNS TABLE(load_id UUID, unread_count BIGINT) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    SELECT lm.load_id, COUNT(*)::BIGINT AS unread_count
    FROM load_messages lm
    WHERE lm.sender_id != p_user_id
      AND (lm.read_by IS NULL OR NOT (lm.read_by ? p_user_id::text))
    GROUP BY lm.load_id HAVING COUNT(*) > 0;
END;
$$;
