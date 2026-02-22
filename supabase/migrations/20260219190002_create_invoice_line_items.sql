-- ═══════════════════════════════════════════════════════════
-- Create invoice_line_items table
-- Stores individual line items belonging to an invoice
--
-- Uses CREATE TABLE IF NOT EXISTS for safe idempotent migration
-- (table may already exist in production)
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS invoice_line_items (
  id               uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id       uuid    NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  load_id          uuid    REFERENCES daily_loads(id),
  description      text    NOT NULL,
  reference_number text,
  service_date     date,
  quantity         numeric,
  unit_price       numeric NOT NULL,
  subtotal         numeric NOT NULL,
  created_at       timestamptz DEFAULT now()
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_invoice_line_items_invoice_id ON invoice_line_items (invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_line_items_load_id    ON invoice_line_items (load_id);

-- Enable Row Level Security (policies defined in 20260219200001_rls_invoices.sql)
ALTER TABLE invoice_line_items ENABLE ROW LEVEL SECURITY;
