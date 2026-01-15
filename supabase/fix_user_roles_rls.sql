-- ==========================================
-- Fix user_roles RLS Policies
-- Enables Admins to assign roles to new users
-- ==========================================

-- Enable RLS just in case
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to prevent conflicts
DROP POLICY IF EXISTS "Admins can manage user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can read own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can read all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Allow read access for all authenticated users" ON public.user_roles;

-- 1. Essential: Allow users to read their OWN role (needed for login/auth checks)
CREATE POLICY "Users can read own roles"
  ON public.user_roles
  FOR SELECT
  USING (user_id = auth.uid());

-- 2. Allow Admins to View ALL roles (needed for Team page)
CREATE POLICY "Admins can view all roles"
  ON public.user_roles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.role = 'admin'
    )
  );

-- 3. Allow Admins to INSERT/UPDATE/DELETE roles (needed for Add Team Member)
CREATE POLICY "Admins can manage roles"
  ON public.user_roles
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.role = 'admin'
    )
  );
