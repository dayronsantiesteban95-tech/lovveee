-- ============================================================
-- Notifications system for task assignments
-- ============================================================

-- Notification type enum
CREATE TYPE public.notification_type AS ENUM (
  'task_assigned',
  'task_updated',
  'task_due_soon',
  'task_overdue',
  'task_completed',
  'task_comment'
);

-- Notifications table
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type notification_type NOT NULL DEFAULT 'task_assigned',
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
  triggered_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Indexes for fast lookups
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_user_unread ON public.notifications(user_id, is_read) WHERE is_read = false;
CREATE INDEX idx_notifications_created_at ON public.notifications(created_at DESC);

-- RLS Policies
CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own notifications"
  ON public.notifications FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Allow system/triggers to insert notifications for anyone
CREATE POLICY "System can insert notifications"
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (true);

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- ============================================================
-- Trigger: Auto-create notification on task assignment/reassignment
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_task_assignment()
RETURNS TRIGGER AS $$
DECLARE
  _assigner_name TEXT;
  _task_title TEXT;
BEGIN
  -- Only fire when assigned_to is set or changed
  IF (TG_OP = 'INSERT' AND NEW.assigned_to IS NOT NULL) OR
     (TG_OP = 'UPDATE' AND NEW.assigned_to IS DISTINCT FROM OLD.assigned_to AND NEW.assigned_to IS NOT NULL) THEN

    -- Don't notify if user assigned to themselves
    IF NEW.assigned_to = COALESCE(NEW.created_by, '00000000-0000-0000-0000-000000000000'::UUID) AND TG_OP = 'INSERT' THEN
      RETURN NEW;
    END IF;

    -- Get the name of who triggered the action
    SELECT full_name INTO _assigner_name
    FROM public.profiles
    WHERE user_id = COALESCE(
      CASE WHEN TG_OP = 'UPDATE' THEN auth.uid() ELSE NEW.created_by END,
      auth.uid()
    )
    LIMIT 1;

    _task_title := NEW.title;

    INSERT INTO public.notifications (user_id, type, title, message, task_id, triggered_by)
    VALUES (
      NEW.assigned_to,
      'task_assigned',
      'New Task Assigned',
      COALESCE(_assigner_name, 'Someone') || ' assigned you a task: "' || _task_title || '"',
      NEW.id,
      COALESCE(
        CASE WHEN TG_OP = 'UPDATE' THEN auth.uid() ELSE NEW.created_by END,
        auth.uid()
      )
    );
  END IF;

  -- Notify on status change (task completed)
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status AND NEW.status = 'done' AND OLD.created_by IS NOT NULL AND OLD.created_by != auth.uid() THEN
    SELECT full_name INTO _assigner_name
    FROM public.profiles
    WHERE user_id = auth.uid()
    LIMIT 1;

    INSERT INTO public.notifications (user_id, type, title, message, task_id, triggered_by)
    VALUES (
      OLD.created_by,
      'task_completed',
      'Task Completed',
      COALESCE(_assigner_name, 'Someone') || ' completed the task: "' || NEW.title || '"',
      NEW.id,
      auth.uid()
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_task_assignment
  AFTER INSERT OR UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.notify_task_assignment();
