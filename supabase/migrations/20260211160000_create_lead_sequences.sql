-- ============================================================
-- Fix: Create tables that were originally created via Supabase
-- dashboard but never captured in migration files.
-- This must run BEFORE migrations that ALTER these tables.
-- ============================================================

-- 1. lead_sequences
CREATE TABLE IF NOT EXISTS public.lead_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  step_type TEXT NOT NULL CHECK (step_type IN ('email_1', 'email_2', 'call')),
  status TEXT NOT NULL DEFAULT 'pending',
  sent_at TIMESTAMPTZ,
  follow_up_date DATE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.lead_sequences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view sequences" ON public.lead_sequences FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert sequences" ON public.lead_sequences FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update sequences" ON public.lead_sequences FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete sequences" ON public.lead_sequences FOR DELETE TO authenticated USING (true);

CREATE TRIGGER update_lead_sequences_updated_at BEFORE UPDATE ON public.lead_sequences FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.lead_sequences;

-- 2. email_templates
CREATE TABLE IF NOT EXISTS public.email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  step_type TEXT NOT NULL DEFAULT 'email_1' CHECK (step_type IN ('email_1', 'email_2', 'call')),
  hub TEXT DEFAULT 'phoenix',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view templates" ON public.email_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert templates" ON public.email_templates FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update templates" ON public.email_templates FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete templates" ON public.email_templates FOR DELETE TO authenticated USING (true);

CREATE TRIGGER update_email_templates_updated_at BEFORE UPDATE ON public.email_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
