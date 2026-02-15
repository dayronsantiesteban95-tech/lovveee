
-- Drop the old check constraint that doesn't allow 'atlanta'
ALTER TABLE public.email_templates DROP CONSTRAINT IF EXISTS email_templates_hub_check;

-- Add a new check constraint that allows atlanta, phoenix, la
ALTER TABLE public.email_templates ADD CONSTRAINT email_templates_hub_check CHECK (hub IN ('atlanta', 'phoenix', 'la'));
