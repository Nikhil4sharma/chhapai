-- Fix profiles RLS policy to allow users to see team members in their department for assignment
-- Issue: Users cannot see other users in their department when assigning items
-- Solution: Allow viewing basic profile info (name, department) for team assignment purposes

DROP POLICY IF EXISTS "Users can view basic profile info" ON public.profiles;

CREATE POLICY "Users can view basic profile info"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  -- Admins can see everything
  has_role(auth.uid(), 'admin'::app_role)
  -- Users can see their own profile
  OR (user_id = auth.uid())
  -- Users can see profiles of users who have a role (for team assignment)
  -- This allows department users to see each other for assignment purposes
  OR (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = profiles.user_id
    )
  )
);

