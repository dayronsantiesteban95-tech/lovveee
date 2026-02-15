-- Add email delivery status tracking to lead_sequences
ALTER TABLE public.lead_sequences
ADD COLUMN IF NOT EXISTS email_delivery_status TEXT DEFAULT 'pending'
CHECK (email_delivery_status IN ('pending', 'sent', 'delivered', 'opened', 'bounced', 'failed'));

-- Add enrichment columns to leads for ZoomInfo integration
ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS enrichment_source TEXT CHECK (enrichment_source IN ('zoominfo', 'apollo', 'manual')),
ADD COLUMN IF NOT EXISTS enrichment_data JSONB;

-- Comment for clarity
COMMENT ON COLUMN public.lead_sequences.email_delivery_status IS 'Tracks Resend email delivery lifecycle';
COMMENT ON COLUMN public.leads.enrichment_source IS 'Source of lead enrichment data (zoominfo, apollo, or manual)';
COMMENT ON COLUMN public.leads.enrichment_data IS 'Raw enrichment payload from external API';
