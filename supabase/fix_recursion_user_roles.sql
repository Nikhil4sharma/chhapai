-- ===============================================
-- Fix Infinite Recursion in user_roles Policies
-- ===============================================

-- Problem: The previous policies on 'user_roles' tried to query 'user_roles' 
-- to check if the user is an admin. This causes an infinite loop (recursion).

-- Solution: We create a "Security Definer" function. 
-- This function runs with higher privileges and bypasses RLS, 
-- allowing it to check the admin role safely without triggering the loop.

-- 1. Create the secure admin check function
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER -- Critical: Runs with creator's permissions, bypassing RLS
SET search_path = public -- Critical: Security best practice
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role = 'admin'
  );
END;
$$;

-- 2. Drop the recursive policies
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can read own roles" ON public.user_roles; -- Re-creating for safety

-- 3. Re-create policies using the safe function

-- Policy 1: Admins can do EVERYTHING (View, Add, Edit, Delete)
CREATE POLICY "Admins can manage roles"
  ON public.user_roles
  FOR ALL
  USING (is_admin()); 
  -- No infinite loop because is_admin() bypasses RLS!

-- Policy 2: Users can view their OWN role (Required for login)
CREATE POLICY "Users can read own roles"
  ON public.user_roles
  FOR SELECT
  USING (user_id = auth.uid());
