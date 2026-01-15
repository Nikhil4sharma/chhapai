-- Fix RLS policies for hr_profiles to use user_roles instead of profiles.department
-- This ensures that Admins and HR users can manage records even if their profile.department is not set correctly.

-- Drop existing policies
DROP POLICY IF EXISTS "HR/Admin can view all profiles" ON public.hr_profiles;
DROP POLICY IF EXISTS "HR/Admin can update all profiles" ON public.hr_profiles;
DROP POLICY IF EXISTS "HR/Admin can insert profiles" ON public.hr_profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.hr_profiles;

-- Re-create Policies using public.has_role()

-- 1. VIEW (SELECT)
-- Admins and HR can view all. Users can view their own.
CREATE POLICY "HR/Admin can view all profiles"
ON public.hr_profiles FOR SELECT
TO authenticated
USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'hr') OR
    user_id = auth.uid()
);

-- 2. INSERT
-- Only Admins and HR can insert.
CREATE POLICY "HR/Admin can insert profiles"
ON public.hr_profiles FOR INSERT
TO authenticated
WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'hr')
);

-- 3. UPDATE
-- Only Admins and HR can update.
CREATE POLICY "HR/Admin can update all profiles"
ON public.hr_profiles FOR UPDATE
TO authenticated
USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'hr')
)
WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'hr')
);

-- 4. DELETE (Optional, but good to have)
CREATE POLICY "HR/Admin can delete profiles"
ON public.hr_profiles FOR DELETE
TO authenticated
USING (
    public.has_role(auth.uid(), 'admin')
);
