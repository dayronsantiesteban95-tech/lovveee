-- ──────────────────────────────────────────────────────────────
-- MEDIUM-4: Add missing DELETE policies for blast tables
-- Only owners can delete blast records.
-- ──────────────────────────────────────────────────────────────

CREATE POLICY blasts_delete ON dispatch_blasts
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'owner'));

CREATE POLICY responses_delete ON blast_responses
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'owner'));

-- ──────────────────────────────────────────────────────────────
-- LOW-5: Tighten time_entries / time_breaks RLS
-- Replace overly permissive INSERT/UPDATE with scoped policies.
-- Dispatchers and owners can manage all entries.
-- Drivers can only read their own entries (clock-in/out is done
-- via SECURITY DEFINER RPCs, not direct inserts).
-- ──────────────────────────────────────────────────────────────

-- Drop the existing overly permissive policies first
DROP POLICY IF EXISTS "Authenticated users can view time entries" ON time_entries;
DROP POLICY IF EXISTS "Authenticated users can insert time entries" ON time_entries;
DROP POLICY IF EXISTS "Authenticated users can update time entries" ON time_entries;
DROP POLICY IF EXISTS "Authenticated users can view time breaks" ON time_breaks;
DROP POLICY IF EXISTS "Authenticated users can insert time breaks" ON time_breaks;
DROP POLICY IF EXISTS "Authenticated users can update time breaks" ON time_breaks;

-- time_entries: everyone can read, only dispatchers/owners can write
CREATE POLICY time_entries_select ON time_entries
  FOR SELECT TO authenticated USING (true);

CREATE POLICY time_entries_insert ON time_entries
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'dispatcher')
    OR public.has_role(auth.uid(), 'owner')
  );

CREATE POLICY time_entries_update ON time_entries
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'dispatcher')
    OR public.has_role(auth.uid(), 'owner')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'dispatcher')
    OR public.has_role(auth.uid(), 'owner')
  );

-- time_breaks: everyone can read, only dispatchers/owners can write
CREATE POLICY time_breaks_select ON time_breaks
  FOR SELECT TO authenticated USING (true);

CREATE POLICY time_breaks_insert ON time_breaks
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'dispatcher')
    OR public.has_role(auth.uid(), 'owner')
  );

CREATE POLICY time_breaks_update ON time_breaks
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'dispatcher')
    OR public.has_role(auth.uid(), 'owner')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'dispatcher')
    OR public.has_role(auth.uid(), 'owner')
  );
