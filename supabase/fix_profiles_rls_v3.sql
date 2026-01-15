-- Fix RLS policies for 'profiles' table to allow Admin/HR to manage users
-- This resolves the "42501" error when adding/editing team members

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;
DROP POLICY IF EXISTS "HR/Admin can manage all profiles" ON public.profiles;

-- Create comprehensive Management Policy for Admin & HR
CREATE POLICY "Admin/HR can manage all profiles"
ON public.profiles
FOR ALL
TO authenticated
USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'hr') OR
    public.has_role(auth.uid(), 'hr_admin') -- legacy safety
)
WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'hr') OR
    public.has_role(auth.uid(), 'hr_admin')
);

-- Ensure Users can still view/update their own profile (Keep existing or re-create)
-- We won't drop "Users can view all profiles" etc as they are usually fine, 
-- but ensuring the Update policy for self exists:
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());
