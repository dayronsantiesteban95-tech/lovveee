-- ═══════════════════════════════════════════════════════════
-- RLS policies for invoices and related tables
-- Drivers cannot create, void, or manage invoices
--
-- Uses has_role() security definer function (defined in
-- 20260211120738_c439a4fe) to avoid RLS recursion on user_roles.
-- app_role enum: 'owner' | 'dispatcher'
-- ═══════════════════════════════════════════════════════════

-- ── invoices ──────────────────────────────────────────────
ALTER TABLE IF EXISTS invoices ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read invoices (dispatchers, owners, drivers can see billing)
CREATE POLICY "Invoices readable by all authenticated users"
  ON invoices FOR SELECT
  TO authenticated
  USING (true);

-- Only dispatchers and owners can create invoices
CREATE POLICY "Invoices insertable by dispatchers and owners"
  ON invoices FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'owner') OR
    public.has_role(auth.uid(), 'dispatcher')
  );

-- Only dispatchers and owners can update invoices (void, mark paid, etc.)
CREATE POLICY "Invoices updatable by dispatchers and owners"
  ON invoices FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'owner') OR
    public.has_role(auth.uid(), 'dispatcher')
  );

-- Only owners can delete invoices
CREATE POLICY "Invoices deletable by owners only"
  ON invoices FOR DELETE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'owner')
  );

-- ── invoice_line_items ────────────────────────────────────
ALTER TABLE IF EXISTS invoice_line_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Invoice line items readable by authenticated"
  ON invoice_line_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Invoice line items manageable by dispatchers and owners"
  ON invoice_line_items FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'owner') OR
    public.has_role(auth.uid(), 'dispatcher')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'owner') OR
    public.has_role(auth.uid(), 'dispatcher')
  );

-- ── invoice_payments ──────────────────────────────────────
ALTER TABLE IF EXISTS invoice_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Invoice payments readable by authenticated"
  ON invoice_payments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Invoice payments manageable by dispatchers and owners"
  ON invoice_payments FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'owner') OR
    public.has_role(auth.uid(), 'dispatcher')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'owner') OR
    public.has_role(auth.uid(), 'dispatcher')
  );
