
-- Restrict user_roles SELECT to own rows only
-- The has_role() function uses SECURITY DEFINER so it bypasses RLS
DROP POLICY "Authenticated users can view roles" ON public.user_roles;

CREATE POLICY "Users can view own role"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);
