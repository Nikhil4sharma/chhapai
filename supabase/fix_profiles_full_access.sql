-- ==========================================
-- Fix Profiles RLS - Full Access for Admins
-- Allows Admins to INSERT, UPDATE, DELETE profiles
-- ==========================================

-- Drop existing restricted policies
DROP POLICY IF EXISTS "Allow admin to insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow users to insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Allow admin to view all profiles" ON public.profiles;

-- 1. Full Access for Admins (Insert, Update, Delete, Select)
CREATE POLICY "Admins can manage all profiles"
  ON public.profiles
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- 2. Users can view/edit their OWN profile
CREATE POLICY "Users can manage own profile"
  ON public.profiles
  FOR ALL
  USING (user_id = auth.uid());

-- 3. Allow inserting own profile (for signup) - might be covered by above, but explicit check
-- This policy specifically handles the INSERT where rows don't exist yet to match above USING clause
CREATE POLICY "Users can insert own profile"
  ON public.profiles
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Fix: The "Admins can manage all profiles" recursive check issue? 
-- No, checking user_roles from profiles policy is fine, UNLESS user_roles checks profiles?
-- user_roles checks itself (is_admin function fixed that recursion).
-- So this is safe.
