-- ═══════════════════════════════════════════════════════════
-- Create invoices table
-- Stores all invoice records for client billing
--
-- Uses CREATE TABLE IF NOT EXISTS for safe idempotent migration
-- (table may already exist in production)
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS invoices (
  id                        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number            text        NOT NULL,
  client_name               text        NOT NULL,
  client_billing_profile_id uuid        REFERENCES client_billing_profiles(id),
  status                    text        DEFAULT 'draft',
  issue_date                date        NOT NULL DEFAULT CURRENT_DATE,
  due_date                  date        NOT NULL,
  subtotal                  numeric,
  tax_amount                numeric,
  total_amount              numeric,
  amount_paid               numeric,
  notes                     text,
  created_by                uuid,
  quickbooks_invoice_id     text,
  quickbooks_synced_at      timestamptz,
  created_at                timestamptz DEFAULT now(),
  updated_at                timestamptz DEFAULT now()
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_number ON invoices (invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_client_name    ON invoices (client_name);
CREATE INDEX IF NOT EXISTS idx_invoices_status         ON invoices (status);

-- Enable Row Level Security (policies defined in 20260219200001_rls_invoices.sql)
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
