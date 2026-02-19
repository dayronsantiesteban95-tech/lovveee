-- ═══════════════════════════════════════════════════════════
-- RLS policies for quickbooks_tokens
-- Only dispatchers and owners can read/manage QB tokens
--
-- Uses has_role() security definer function (defined in
-- 20260211120738_c439a4fe) to avoid RLS recursion on user_roles.
-- app_role enum: 'owner' | 'dispatcher'
-- ═══════════════════════════════════════════════════════════

ALTER TABLE IF EXISTS quickbooks_tokens ENABLE ROW LEVEL SECURITY;

-- Only owner/dispatcher roles can SELECT QB tokens
CREATE POLICY "QB tokens readable by dispatchers and owners"
  ON quickbooks_tokens FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'owner') OR
    public.has_role(auth.uid(), 'dispatcher')
  );

-- Only owners can INSERT QB tokens
CREATE POLICY "QB tokens insertable by owners only"
  ON quickbooks_tokens FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'owner')
  );

-- Only owners can UPDATE QB tokens
CREATE POLICY "QB tokens updatable by owners only"
  ON quickbooks_tokens FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'owner')
  );

-- Only owners can DELETE QB tokens (disconnect QB)
CREATE POLICY "QB tokens deletable by owners only"
  ON quickbooks_tokens FOR DELETE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'owner')
  );
