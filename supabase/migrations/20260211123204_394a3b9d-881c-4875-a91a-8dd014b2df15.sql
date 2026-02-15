
-- Create task_comments table
CREATE TABLE public.task_comments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;

-- RLS policies matching existing task access patterns
CREATE POLICY "Authenticated can view task comments"
ON public.task_comments FOR SELECT
USING (true);

CREATE POLICY "Authenticated can create task comments"
ON public.task_comments FOR INSERT
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update own comments"
ON public.task_comments FOR UPDATE
USING (auth.uid() = created_by);

CREATE POLICY "Users can delete own comments"
ON public.task_comments FOR DELETE
USING (auth.uid() = created_by);
