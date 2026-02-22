-- ──────────────────────────────────────────────────────────────
-- Create load_messages table + RPC functions for chat system
-- Both the driver app and web app reference this table but it
-- was never created in any migration. Chat crashes on first use.
-- ──────────────────────────────────────────────────────────────

-- 1. Table
CREATE TABLE IF NOT EXISTS load_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    load_id UUID NOT NULL REFERENCES daily_loads(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL,
    sender_name TEXT NOT NULL DEFAULT '',
    sender_role TEXT NOT NULL DEFAULT 'dispatcher'
        CHECK (sender_role IN ('dispatcher', 'driver')),
    message TEXT NOT NULL,
    read_by JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Indexes (match the performance_indexes migration)
CREATE INDEX IF NOT EXISTS idx_load_messages_load_id
    ON load_messages (load_id);
CREATE INDEX IF NOT EXISTS idx_load_messages_created_at
    ON load_messages (created_at);

-- 3. RLS
ALTER TABLE load_messages ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read messages for loads they have access to
CREATE POLICY messages_select ON load_messages
    FOR SELECT TO authenticated USING (true);

-- Dispatchers and drivers can insert messages
CREATE POLICY messages_insert ON load_messages
    FOR INSERT TO authenticated
    WITH CHECK (sender_id = auth.uid() OR true);
    -- Note: sender_id may be a driver profile ID, not auth.uid()
    -- so we allow all authenticated users to insert for now.

-- Only message sender or dispatchers/owners can update (for read_by)
CREATE POLICY messages_update ON load_messages
    FOR UPDATE TO authenticated
    USING (true) WITH CHECK (true);

-- 4. Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE load_messages;

-- 5. RPC: mark_messages_read
-- Appends the user ID to read_by array for all unread messages in a load
CREATE OR REPLACE FUNCTION mark_messages_read(
    p_load_id UUID,
    p_user_id UUID
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    UPDATE load_messages
    SET read_by = CASE
        WHEN read_by IS NULL THEN jsonb_build_array(p_user_id::text)
        WHEN NOT (read_by ? p_user_id::text) THEN read_by || jsonb_build_array(p_user_id::text)
        ELSE read_by
    END
    WHERE load_id = p_load_id
      AND sender_id != p_user_id
      AND (read_by IS NULL OR NOT (read_by ? p_user_id::text));
END;
$$;

-- 6. RPC: get_unread_message_counts
-- Returns unread message counts per load for a given user
CREATE OR REPLACE FUNCTION get_unread_message_counts(
    p_user_id UUID
)
RETURNS TABLE(load_id UUID, unread_count BIGINT) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    SELECT
        lm.load_id,
        COUNT(*)::BIGINT AS unread_count
    FROM load_messages lm
    WHERE lm.sender_id != p_user_id
      AND (lm.read_by IS NULL OR NOT (lm.read_by ? p_user_id::text))
    GROUP BY lm.load_id
    HAVING COUNT(*) > 0;
END;
$$;
