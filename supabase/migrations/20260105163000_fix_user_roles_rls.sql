-- Fix RLS policy for user_roles to allow authenticated users to view all roles
-- This is necessary for team assignment features where users need to see who is in which department.

-- Drop the restrictive policy
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;

-- Create a permissive policy for SELECT
CREATE POLICY "Authenticated users can view all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (true);

-- Ensure profiles are also visible (re-affirming public read, though usually enabled)
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
CREATE POLICY "Users can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);
