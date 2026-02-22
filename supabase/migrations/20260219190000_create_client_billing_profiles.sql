-- ═══════════════════════════════════════════════════════════
-- Create client_billing_profiles table
-- Stores billing configuration for each client
--
-- Uses CREATE TABLE IF NOT EXISTS for safe idempotent migration
-- (table may already exist in production)
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS client_billing_profiles (
  id                     uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name            text    NOT NULL,
  billing_email          text,
  payment_terms          integer,
  invoice_frequency      text,
  fuel_surcharge_pct     numeric,
  quickbooks_customer_id text,
  notes                  text,
  created_at             timestamptz DEFAULT now(),
  updated_at             timestamptz DEFAULT now()
);

-- Index for common query patterns
CREATE INDEX IF NOT EXISTS idx_client_billing_profiles_client_name ON client_billing_profiles (client_name);

-- Enable Row Level Security
ALTER TABLE client_billing_profiles ENABLE ROW LEVEL SECURITY;
