-- ═══════════════════════════════════════════════════════════
-- Create quickbooks_tokens table
-- Stores OAuth tokens for QuickBooks Online integration
--
-- Uses CREATE TABLE IF NOT EXISTS for safe idempotent migration
-- (table may already exist in production)
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS quickbooks_tokens (
  id                        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  realm_id                  text        NOT NULL,
  access_token              text        NOT NULL,
  refresh_token             text        NOT NULL,
  access_token_expires_at   timestamptz NOT NULL,
  refresh_token_expires_at  timestamptz NOT NULL,
  connected_by              uuid,
  environment               text,
  created_at                timestamptz DEFAULT now(),
  updated_at                timestamptz DEFAULT now()
);

-- Enable Row Level Security (policies defined in 20260219200000_rls_quickbooks_tokens.sql)
ALTER TABLE quickbooks_tokens ENABLE ROW LEVEL SECURITY;
