-- CHUNK7: Critical RLS Security Fix
-- Removes dangerous qual=true backdoor policies that let any authenticated user
-- bypass all access controls. Adds proper role-based restrictions.
-- Also creates set_user_metadata RPC for the signUp fallback flow.

-- ============================================================================
-- 1. CRITICAL: Fix user_roles privilege escalation
--    Any user could promote themselves to "owner"
-- ============================================================================

DROP POLICY IF EXISTS "user_roles_update_owner" ON user_roles;
DROP POLICY IF EXISTS "user_roles_insert_owner" ON user_roles;
DROP POLICY IF EXISTS "user_roles_delete_owner" ON user_roles;

-- Only allow reading own role; owners/dispatchers can read all
CREATE POLICY "user_roles_select" ON user_roles FOR SELECT USING (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('owner','dispatcher'))
);

-- Only owners can modify roles (via Edge Function with service_role, or RPC)
CREATE POLICY "user_roles_modify_owner_only" ON user_roles
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'owner')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'owner')
  );

-- ============================================================================
-- 2. Remove ALL qual=true backdoor policies
-- ============================================================================

-- daily_loads: drivers should only see loads assigned to them
DROP POLICY IF EXISTS "daily_loads_auth" ON daily_loads;

-- dispatch_blasts & blast_responses
DROP POLICY IF EXISTS "dispatch_blasts_auth" ON dispatch_blasts;
DROP POLICY IF EXISTS "blast_responses_auth" ON blast_responses;

-- driver_locations: drivers should only write their own location
DROP POLICY IF EXISTS "driver_locations_auth" ON driver_locations;

-- load_messages
DROP POLICY IF EXISTS "load_messages_auth" ON load_messages;

-- load_status_events
DROP POLICY IF EXISTS "load_status_events_auth" ON load_status_events;

-- pod_submissions
DROP POLICY IF EXISTS "pod_submissions_auth" ON pod_submissions;

-- vehicle_inspections (has TWO backdoor policies)
DROP POLICY IF EXISTS "vehicle_inspections_auth" ON vehicle_inspections;
DROP POLICY IF EXISTS "Auth users can manage inspections" ON vehicle_inspections;

-- invoices + line items + payments
DROP POLICY IF EXISTS "Auth users can manage invoices" ON invoices;
DROP POLICY IF EXISTS "Auth users can manage invoice line items" ON invoice_line_items;
DROP POLICY IF EXISTS "Auth users can manage invoice payments" ON invoice_payments;

-- quickbooks
DROP POLICY IF EXISTS "Auth users manage QB tokens" ON quickbooks_tokens;
DROP POLICY IF EXISTS "Auth users manage QB sync log" ON quickbooks_sync_log;

-- other tables with qual=true ALL policies
DROP POLICY IF EXISTS "Auth users manage geofence events" ON load_geofence_events;
DROP POLICY IF EXISTS "Auth users can manage billing profiles" ON client_billing_profiles;
DROP POLICY IF EXISTS "Auth users can manage car washes" ON vehicle_car_washes;
DROP POLICY IF EXISTS "Auth users can manage maintenance" ON vehicle_maintenance;

-- ============================================================================
-- 3. Helper: check if caller is owner or dispatcher
-- ============================================================================

CREATE OR REPLACE FUNCTION is_owner_or_dispatcher()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('owner','dispatcher')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION is_owner()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = 'owner'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

-- ============================================================================
-- 4. Add proper role-based policies for HIGH-risk tables
-- ============================================================================

-- daily_loads: owners/dispatchers see all; drivers see assigned loads only
CREATE POLICY "daily_loads_role_access" ON daily_loads FOR ALL USING (
  is_owner_or_dispatcher()
  OR driver_id::text = auth.uid()::text
  OR assigned_driver::text = auth.uid()::text
) WITH CHECK (
  is_owner_or_dispatcher()
);

-- dispatch_blasts: owners/dispatchers only
CREATE POLICY "dispatch_blasts_role_access" ON dispatch_blasts FOR ALL USING (
  is_owner_or_dispatcher()
) WITH CHECK (
  is_owner_or_dispatcher()
);

-- blast_responses: owners/dispatchers can manage; drivers can read/insert own
CREATE POLICY "blast_responses_role_access" ON blast_responses FOR ALL USING (
  is_owner_or_dispatcher()
  OR driver_id::text = auth.uid()::text
) WITH CHECK (
  is_owner_or_dispatcher()
  OR driver_id::text = auth.uid()::text
);

-- driver_locations: drivers insert/update own; owners/dispatchers read all
CREATE POLICY "driver_locations_role_access" ON driver_locations FOR SELECT USING (
  is_owner_or_dispatcher()
  OR driver_id::text = auth.uid()::text
);
CREATE POLICY "driver_locations_write_own" ON driver_locations FOR INSERT WITH CHECK (
  driver_id::text = auth.uid()::text
  OR is_owner_or_dispatcher()
);
CREATE POLICY "driver_locations_update_own" ON driver_locations FOR UPDATE USING (
  driver_id::text = auth.uid()::text
  OR is_owner_or_dispatcher()
);

-- load_messages: auth users can read messages for loads they're part of; dispatchers see all
CREATE POLICY "load_messages_role_access" ON load_messages FOR ALL USING (
  is_owner_or_dispatcher()
  OR sender_id = auth.uid()
) WITH CHECK (
  is_owner_or_dispatcher()
  OR sender_id = auth.uid()
);

-- load_status_events: owners/dispatchers full access; drivers can insert for assigned loads
CREATE POLICY "load_status_events_role_access" ON load_status_events FOR ALL USING (
  is_owner_or_dispatcher()
  OR created_by = auth.uid()
) WITH CHECK (
  is_owner_or_dispatcher()
  OR created_by = auth.uid()
);

-- pod_submissions: drivers can manage own; dispatchers/owners see all
CREATE POLICY "pod_submissions_role_access" ON pod_submissions FOR ALL USING (
  is_owner_or_dispatcher()
  OR driver_id::text = auth.uid()::text
) WITH CHECK (
  is_owner_or_dispatcher()
  OR driver_id::text = auth.uid()::text
);

-- vehicle_inspections: owners/dispatchers full access; drivers see own
CREATE POLICY "vehicle_inspections_role_access" ON vehicle_inspections FOR ALL USING (
  is_owner_or_dispatcher()
  OR inspector_id::text = auth.uid()::text
) WITH CHECK (
  is_owner_or_dispatcher()
  OR inspector_id::text = auth.uid()::text
);

-- invoices: owners/dispatchers only
CREATE POLICY "invoices_role_access" ON invoices FOR ALL USING (
  is_owner_or_dispatcher()
) WITH CHECK (
  is_owner_or_dispatcher()
);

CREATE POLICY "invoice_line_items_role_access" ON invoice_line_items FOR ALL USING (
  is_owner_or_dispatcher()
) WITH CHECK (
  is_owner_or_dispatcher()
);

CREATE POLICY "invoice_payments_role_access" ON invoice_payments FOR ALL USING (
  is_owner_or_dispatcher()
) WITH CHECK (
  is_owner_or_dispatcher()
);

-- quickbooks: owners only
CREATE POLICY "quickbooks_tokens_owner_access" ON quickbooks_tokens FOR ALL USING (
  is_owner()
) WITH CHECK (
  is_owner()
);

CREATE POLICY "quickbooks_sync_log_role_access" ON quickbooks_sync_log FOR ALL USING (
  is_owner_or_dispatcher()
) WITH CHECK (
  is_owner_or_dispatcher()
);

-- load_geofence_events: owners/dispatchers full; drivers read own
CREATE POLICY "load_geofence_events_role_access" ON load_geofence_events FOR ALL USING (
  is_owner_or_dispatcher()
  OR driver_id::text = auth.uid()::text
) WITH CHECK (
  is_owner_or_dispatcher()
);

-- client_billing_profiles: owners/dispatchers only
CREATE POLICY "client_billing_profiles_role_access" ON client_billing_profiles FOR ALL USING (
  is_owner_or_dispatcher()
) WITH CHECK (
  is_owner_or_dispatcher()
);

-- vehicle_car_washes: owners/dispatchers only
CREATE POLICY "vehicle_car_washes_role_access" ON vehicle_car_washes FOR ALL USING (
  is_owner_or_dispatcher()
) WITH CHECK (
  is_owner_or_dispatcher()
);

-- vehicle_maintenance: owners/dispatchers only
CREATE POLICY "vehicle_maintenance_role_access" ON vehicle_maintenance FOR ALL USING (
  is_owner_or_dispatcher()
) WITH CHECK (
  is_owner_or_dispatcher()
);

-- ============================================================================
-- 5. Fix MEDIUM-risk tables
-- ============================================================================

-- time_entries: drivers see own; owners/dispatchers see all
DROP POLICY IF EXISTS "time_entries_select" ON time_entries;
DROP POLICY IF EXISTS "time_entries_insert" ON time_entries;
DROP POLICY IF EXISTS "time_entries_update" ON time_entries;
DROP POLICY IF EXISTS "time_entries_delete" ON time_entries;

CREATE POLICY "time_entries_access" ON time_entries FOR ALL USING (
  is_owner_or_dispatcher()
  OR driver_id::text = auth.uid()::text
) WITH CHECK (
  is_owner_or_dispatcher()
  OR driver_id::text = auth.uid()::text
);

-- time_breaks: same pattern
DROP POLICY IF EXISTS "time_breaks_select" ON time_breaks;
DROP POLICY IF EXISTS "time_breaks_insert" ON time_breaks;
DROP POLICY IF EXISTS "time_breaks_update" ON time_breaks;

CREATE POLICY "time_breaks_access" ON time_breaks FOR ALL USING (
  is_owner_or_dispatcher()
  OR EXISTS (
    SELECT 1 FROM time_entries te
    WHERE te.id = time_breaks.entry_id
      AND te.driver_id::text = auth.uid()::text
  )
) WITH CHECK (
  is_owner_or_dispatcher()
  OR EXISTS (
    SELECT 1 FROM time_entries te
    WHERE te.id = time_breaks.entry_id
      AND te.driver_id::text = auth.uid()::text
  )
);

-- driver_shifts: drivers see own; owners/dispatchers see all
DROP POLICY IF EXISTS "driver_shifts_select" ON driver_shifts;
DROP POLICY IF EXISTS "driver_shifts_insert" ON driver_shifts;
DROP POLICY IF EXISTS "driver_shifts_update" ON driver_shifts;

CREATE POLICY "driver_shifts_access" ON driver_shifts FOR ALL USING (
  is_owner_or_dispatcher()
  OR driver_id::text = auth.uid()::text
) WITH CHECK (
  is_owner_or_dispatcher()
  OR driver_id::text = auth.uid()::text
);

-- saved_quotes: owners/dispatchers only
DROP POLICY IF EXISTS "saved_quotes_select" ON saved_quotes;
DROP POLICY IF EXISTS "saved_quotes_insert" ON saved_quotes;

CREATE POLICY "saved_quotes_role_access" ON saved_quotes FOR ALL USING (
  is_owner_or_dispatcher()
) WITH CHECK (
  is_owner_or_dispatcher()
);

-- daily_dispatches
DROP POLICY IF EXISTS "daily_dispatches_select" ON daily_dispatches;
DROP POLICY IF EXISTS "daily_dispatches_insert" ON daily_dispatches;
DROP POLICY IF EXISTS "daily_dispatches_update" ON daily_dispatches;
DROP POLICY IF EXISTS "daily_dispatches_delete" ON daily_dispatches;

CREATE POLICY "daily_dispatches_role_access" ON daily_dispatches FOR ALL USING (
  is_owner_or_dispatcher()
) WITH CHECK (
  is_owner_or_dispatcher()
);

-- ============================================================================
-- 6. set_user_metadata RPC for signUp fallback
-- ============================================================================

CREATE OR REPLACE FUNCTION set_user_metadata(p_user_id UUID, p_metadata JSONB)
RETURNS void AS $$
DECLARE
  caller_role TEXT;
BEGIN
  -- Only owners/dispatchers can set other users' metadata
  SELECT role INTO caller_role FROM public.user_roles WHERE user_id = auth.uid();
  IF caller_role NOT IN ('owner','dispatcher') THEN
    RAISE EXCEPTION 'Only owners and dispatchers can set user metadata';
  END IF;

  UPDATE auth.users
  SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || p_metadata
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
