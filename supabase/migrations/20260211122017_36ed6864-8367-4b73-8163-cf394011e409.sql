
-- Department enum
CREATE TYPE public.department AS ENUM ('onboarding', 'operations', 'prospecting', 'clients');

-- Add department to tasks
ALTER TABLE public.tasks ADD COLUMN department department;

-- Activity type enum for CRM interactions
CREATE TYPE public.activity_type AS ENUM ('note', 'email', 'call', 'meeting');

-- Add activity_type to lead_interactions
ALTER TABLE public.lead_interactions ADD COLUMN activity_type activity_type NOT NULL DEFAULT 'note';

-- Companies table (HubSpot-style separate from leads)
CREATE TABLE public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  industry TEXT,
  website TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Contacts table (linked to companies)
CREATE TABLE public.contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  job_title TEXT,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON public.contacts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Link leads to companies
ALTER TABLE public.leads ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL;

-- Follow-up sequences / auto-reminders
CREATE TABLE public.follow_up_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_stage lead_stage NOT NULL,
  days_after INTEGER NOT NULL DEFAULT 3,
  task_title TEXT NOT NULL,
  task_priority task_priority NOT NULL DEFAULT 'medium',
  department department,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.follow_up_rules ENABLE ROW LEVEL SECURITY;

-- RLS for companies (all authenticated team members)
CREATE POLICY "Authenticated can view companies" ON public.companies FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can create companies" ON public.companies FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Authenticated can update companies" ON public.companies FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete companies" ON public.companies FOR DELETE TO authenticated USING (true);

-- RLS for contacts
CREATE POLICY "Authenticated can view contacts" ON public.contacts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can create contacts" ON public.contacts FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Authenticated can update contacts" ON public.contacts FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete contacts" ON public.contacts FOR DELETE TO authenticated USING (true);

-- RLS for follow_up_rules (owners manage, all can view)
CREATE POLICY "Authenticated can view rules" ON public.follow_up_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owners can manage rules" ON public.follow_up_rules FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'owner'));
CREATE POLICY "Owners can update rules" ON public.follow_up_rules FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'owner'));
CREATE POLICY "Owners can delete rules" ON public.follow_up_rules FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'owner'));

-- Add update policy for lead_interactions
CREATE POLICY "Authenticated can update interactions" ON public.lead_interactions FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete interactions" ON public.lead_interactions FOR DELETE TO authenticated USING (true);

-- Enable realtime for new tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.companies;
ALTER PUBLICATION supabase_realtime ADD TABLE public.contacts;
