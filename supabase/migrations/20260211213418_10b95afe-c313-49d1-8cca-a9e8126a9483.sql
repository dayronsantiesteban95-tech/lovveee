
-- ============================================================
-- Security Hardening: Tighten RLS + NOT NULL created_by
-- ============================================================

-- 1. COMPANIES
DROP POLICY IF EXISTS "Authenticated can update companies" ON public.companies;
DROP POLICY IF EXISTS "Authenticated can delete companies" ON public.companies;

CREATE POLICY "Creator or owner can update companies" ON public.companies
  FOR UPDATE USING ((auth.uid() = created_by) OR has_role(auth.uid(), 'owner'));

CREATE POLICY "Creator or owner can delete companies" ON public.companies
  FOR DELETE USING ((auth.uid() = created_by) OR has_role(auth.uid(), 'owner'));

ALTER TABLE public.companies ALTER COLUMN created_by SET DEFAULT auth.uid();
ALTER TABLE public.companies ALTER COLUMN created_by SET NOT NULL;

-- 2. CONTACTS
DROP POLICY IF EXISTS "Authenticated can update contacts" ON public.contacts;
DROP POLICY IF EXISTS "Authenticated can delete contacts" ON public.contacts;

CREATE POLICY "Creator or owner can update contacts" ON public.contacts
  FOR UPDATE USING ((auth.uid() = created_by) OR has_role(auth.uid(), 'owner'));

CREATE POLICY "Creator or owner can delete contacts" ON public.contacts
  FOR DELETE USING ((auth.uid() = created_by) OR has_role(auth.uid(), 'owner'));

ALTER TABLE public.contacts ALTER COLUMN created_by SET DEFAULT auth.uid();
ALTER TABLE public.contacts ALTER COLUMN created_by SET NOT NULL;

-- 3. LEADS
DROP POLICY IF EXISTS "Authenticated can update leads" ON public.leads;
DROP POLICY IF EXISTS "Authenticated can delete leads" ON public.leads;

CREATE POLICY "Creator or owner can update leads" ON public.leads
  FOR UPDATE USING ((auth.uid() = created_by) OR has_role(auth.uid(), 'owner'));

CREATE POLICY "Creator or owner can delete leads" ON public.leads
  FOR DELETE USING ((auth.uid() = created_by) OR has_role(auth.uid(), 'owner'));

ALTER TABLE public.leads ALTER COLUMN created_by SET DEFAULT auth.uid();
ALTER TABLE public.leads ALTER COLUMN created_by SET NOT NULL;

-- 4. LEAD_INTERACTIONS
DROP POLICY IF EXISTS "Authenticated can update interactions" ON public.lead_interactions;
DROP POLICY IF EXISTS "Authenticated can delete interactions" ON public.lead_interactions;

CREATE POLICY "Creator or owner can update interactions" ON public.lead_interactions
  FOR UPDATE USING ((auth.uid() = created_by) OR has_role(auth.uid(), 'owner'));

CREATE POLICY "Creator or owner can delete interactions" ON public.lead_interactions
  FOR DELETE USING ((auth.uid() = created_by) OR has_role(auth.uid(), 'owner'));

ALTER TABLE public.lead_interactions ALTER COLUMN created_by SET DEFAULT auth.uid();
ALTER TABLE public.lead_interactions ALTER COLUMN created_by SET NOT NULL;

-- 5. LEAD_SEQUENCES
DROP POLICY IF EXISTS "Authenticated can update sequences" ON public.lead_sequences;
DROP POLICY IF EXISTS "Authenticated can delete sequences" ON public.lead_sequences;

CREATE POLICY "Creator or owner can update sequences" ON public.lead_sequences
  FOR UPDATE USING ((auth.uid() = created_by) OR has_role(auth.uid(), 'owner'));

CREATE POLICY "Creator or owner can delete sequences" ON public.lead_sequences
  FOR DELETE USING ((auth.uid() = created_by) OR has_role(auth.uid(), 'owner'));

ALTER TABLE public.lead_sequences ALTER COLUMN created_by SET DEFAULT auth.uid();
ALTER TABLE public.lead_sequences ALTER COLUMN created_by SET NOT NULL;

-- 6. EMAIL_TEMPLATES
DROP POLICY IF EXISTS "Authenticated can update templates" ON public.email_templates;
DROP POLICY IF EXISTS "Authenticated can delete templates" ON public.email_templates;

CREATE POLICY "Creator or owner can update templates" ON public.email_templates
  FOR UPDATE USING ((auth.uid() = created_by) OR has_role(auth.uid(), 'owner'));

CREATE POLICY "Creator or owner can delete templates" ON public.email_templates
  FOR DELETE USING ((auth.uid() = created_by) OR has_role(auth.uid(), 'owner'));

ALTER TABLE public.email_templates ALTER COLUMN created_by SET DEFAULT auth.uid();
ALTER TABLE public.email_templates ALTER COLUMN created_by SET NOT NULL;

-- 7. SOP_ARTICLES
DROP POLICY IF EXISTS "Authenticated can update SOPs" ON public.sop_articles;
DROP POLICY IF EXISTS "Authenticated can delete SOPs" ON public.sop_articles;

CREATE POLICY "Creator or owner can update SOPs" ON public.sop_articles
  FOR UPDATE USING ((auth.uid() = created_by) OR has_role(auth.uid(), 'owner'));

CREATE POLICY "Creator or owner can delete SOPs" ON public.sop_articles
  FOR DELETE USING ((auth.uid() = created_by) OR has_role(auth.uid(), 'owner'));

ALTER TABLE public.sop_articles ALTER COLUMN created_by SET DEFAULT auth.uid();
ALTER TABLE public.sop_articles ALTER COLUMN created_by SET NOT NULL;

-- 8. TASKS (creator OR assigned_to OR owner for UPDATE; creator OR owner for DELETE)
DROP POLICY IF EXISTS "Authenticated can update tasks" ON public.tasks;
DROP POLICY IF EXISTS "Authenticated can delete tasks" ON public.tasks;

CREATE POLICY "Creator assignee or owner can update tasks" ON public.tasks
  FOR UPDATE USING ((auth.uid() = created_by) OR (auth.uid() = assigned_to) OR has_role(auth.uid(), 'owner'));

CREATE POLICY "Creator or owner can delete tasks" ON public.tasks
  FOR DELETE USING ((auth.uid() = created_by) OR has_role(auth.uid(), 'owner'));

ALTER TABLE public.tasks ALTER COLUMN created_by SET DEFAULT auth.uid();
ALTER TABLE public.tasks ALTER COLUMN created_by SET NOT NULL;

-- 9. TASK_LEAD_LINKS (owner only for INSERT/DELETE, tighten existing)
DROP POLICY IF EXISTS "Authenticated can delete task-lead links" ON public.task_lead_links;
DROP POLICY IF EXISTS "Authenticated can manage task-lead links" ON public.task_lead_links;

CREATE POLICY "Authenticated can manage task-lead links" ON public.task_lead_links
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Owner can delete task-lead links" ON public.task_lead_links
  FOR DELETE USING (has_role(auth.uid(), 'owner'));
