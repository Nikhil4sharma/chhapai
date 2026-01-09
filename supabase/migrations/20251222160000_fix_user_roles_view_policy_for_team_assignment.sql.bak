-- Fix RLS Policy for user_roles to allow team assignment
-- Users need to view all user_roles to assign items to team members in their department
-- 
-- ISSUE: Current policy only allows users to view their own role or admins to view all
-- This prevents team members from seeing other team members for assignment
--
-- SOLUTION: Allow authenticated users to view all user_roles (for team assignment)
-- This is safe because:
-- 1. Only authenticated users can access
-- 2. Role information is not sensitive (it's needed for workflow)
-- 3. Users can already see profiles (which contain department info)

-- Drop the restrictive policy
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;

-- Create new policy that allows all authenticated users to view all roles
-- This is needed for team assignment functionality
CREATE POLICY "Authenticated users can view all roles for team assignment"
ON public.user_roles FOR SELECT
TO authenticated
USING (true);

COMMENT ON POLICY "Authenticated users can view all roles for team assignment" ON public.user_roles IS 
'Allows authenticated users to view all user_roles for team assignment purposes. Users need to see team members in their department to assign orders/products.';

-- Keep admin management policies as they are
-- (Admins can manage all roles - already exists)

