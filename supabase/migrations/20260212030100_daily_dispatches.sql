-- Daily Dispatches table for Google Sheets two-way sync
CREATE TABLE public.daily_dispatches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_date DATE NOT NULL DEFAULT CURRENT_DATE,
  vehicle_id TEXT NOT NULL,
  driver_name TEXT NOT NULL,
  route TEXT,
  stops INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
  notes TEXT,
  synced_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.daily_dispatches ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated can view dispatches" ON public.daily_dispatches FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can create dispatches" ON public.daily_dispatches FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update dispatches" ON public.daily_dispatches FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete dispatches" ON public.daily_dispatches FOR DELETE TO authenticated USING (true);

-- Updated_at trigger
CREATE TRIGGER update_daily_dispatches_updated_at BEFORE UPDATE ON public.daily_dispatches FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_dispatches;
