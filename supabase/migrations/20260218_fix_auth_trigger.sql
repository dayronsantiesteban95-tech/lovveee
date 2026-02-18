-- ═══════════════════════════════════════════════════════════════
-- Fix: Auto-create user_roles row on signup
-- 
-- The handle_new_user trigger creates a profile row but does NOT
-- create a user_roles row, leaving new users with no role.
-- This migration:
--   1. Updates the trigger to also create a default 'dispatcher' role
--   2. Backfills any existing profiles that have no role
--   3. Fixes the broken set_owner migration (profiles.role doesn't exist)
-- ═══════════════════════════════════════════════════════════════

-- Update the handle_new_user trigger to also create a default role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Create profile row
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email))
  ON CONFLICT (user_id) DO NOTHING;

  -- Create default dispatcher role (can be upgraded to owner later)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'dispatcher')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Backfill: give all users with no role a default 'dispatcher' role
INSERT INTO public.user_roles (user_id, role)
SELECT p.user_id, 'dispatcher'
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_roles r WHERE r.user_id = p.user_id
)
ON CONFLICT (user_id, role) DO NOTHING;

-- Fix set_owner: set Dayron's role correctly in user_roles (not profiles)
-- The previous migration tried to add a 'role' column to profiles which doesn't exist
INSERT INTO public.user_roles (user_id, role)
SELECT au.id, 'owner'
FROM auth.users au
WHERE au.email = 'dayron.santiesteban95@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- Also remove any 'dispatcher' role if 'owner' was just set for Dayron
-- (user_roles has UNIQUE(user_id, role), so a user can have multiple roles,
--  but for clean UX we want exactly one role per user)
-- This is safe to skip if you want multi-role support later.
