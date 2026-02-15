
-- Create nurture_settings table
CREATE TABLE public.nurture_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key text NOT NULL UNIQUE,
  setting_value text NOT NULL,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.nurture_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view settings"
ON public.nurture_settings FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Owners can insert settings"
ON public.nurture_settings FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Owners can update settings"
ON public.nurture_settings FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Owners can delete settings"
ON public.nurture_settings FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'owner'));

-- Insert default settings
INSERT INTO public.nurture_settings (setting_key, setting_value) VALUES
  ('email1_to_email2_days', '3'),
  ('email2_to_call_days', '4'),
  ('no_response_snooze_days', '3');

-- Add note column to lead_sequences
ALTER TABLE public.lead_sequences ADD COLUMN note text;
