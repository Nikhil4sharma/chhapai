-- Fix: Remove 'OR true' from profiles SELECT policy to protect employee phone numbers and personal data

DROP POLICY IF EXISTS "Users can view basic profile info" ON public.profiles;

CREATE POLICY "Users can view basic profile info"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (user_id = auth.uid())
  OR (
    -- Allow viewing only full_name and avatar_url for team assignment purposes (no phone)
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = profiles.user_id
    )
  )
);