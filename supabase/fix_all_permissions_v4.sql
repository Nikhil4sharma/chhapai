-- FINAL PERMISSION FIX (v4)
-- Run this script to fix ALL '42501' and '403' errors for Admin/HR users.

BEGIN;

-- 1. Ensure public.has_role is SECURITY DEFINER (Bypasses RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER -- CRITICAL: Runs with privileges of creator (postgres), bypassing RLS
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
    AND role = _role
  );
END;
$$;

-- 2. Grant Permissions to standard tables just in case
GRANT ALL ON public.profiles TO authenticated;
GRANT ALL ON public.hr_profiles TO authenticated;
GRANT ALL ON public.user_roles TO authenticated;

-- 3. Reset RLS on hr_profiles (The one causing error in screenshot)
ALTER TABLE public.hr_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Manage HR Profiles" ON public.hr_profiles;
DROP POLICY IF EXISTS "HR/Admin can view all profiles" ON public.hr_profiles;
DROP POLICY IF EXISTS "HR/Admin can insert profiles" ON public.hr_profiles;
DROP POLICY IF EXISTS "HR/Admin can update all profiles" ON public.hr_profiles;

CREATE POLICY "Manage HR Profiles"
ON public.hr_profiles
FOR ALL
TO authenticated
USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'hr') OR 
    user_id = auth.uid()
)
WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'hr') OR 
    user_id = auth.uid()
);

-- 4. Reset RLS on profiles (For adding new members)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Manage Profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admin/HR can manage all profiles" ON public.profiles;

CREATE POLICY "Manage Profiles"
ON public.profiles
FOR ALL
TO authenticated
USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'hr') OR 
    user_id = auth.uid()
)
WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'hr') OR 
    user_id = auth.uid()
);

-- 5. Reset RLS on user_roles (For assigning roles)
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Manage User Roles" ON public.user_roles;

CREATE POLICY "Manage User Roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'hr') OR 
    user_id = auth.uid()
)
WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'hr')
);

COMMIT;
