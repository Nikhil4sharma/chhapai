-- FIX EMPLOYEES TABLE RLS (v7)

-- The employees table policies were checking profiles.department,
-- but we should be using the centralized public.has_role() function.

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

-- Drop incorrect policies
DROP POLICY IF EXISTS "HR/Admin can view all employees" ON public.employees;
DROP POLICY IF EXISTS "HR/Admin can manage employees" ON public.employees;
DROP POLICY IF EXISTS "Users can view own employee record" ON public.employees;

-- Re-create Policies using public.has_role()

-- 1. VIEW (SELECT)
-- Admins/HR can view all. Users can view their own.
CREATE POLICY "HR/Admin can view all employees"
ON public.employees FOR SELECT
TO authenticated
USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'hr') OR
    public.has_role(auth.uid(), 'hr_admin') OR
    user_id = auth.uid()
);

-- 2. MANAGE (INSERT, UPDATE, DELETE)
-- Only Admins/HR can manage.
CREATE POLICY "HR/Admin can manage employees"
ON public.employees FOR ALL
TO authenticated
USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'hr') OR
    public.has_role(auth.uid(), 'hr_admin')
)
WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'hr') OR
    public.has_role(auth.uid(), 'hr_admin')
);

-- 3. Ensure "Users can view own employee record" (Self-service fallback)
-- Actually covered in the first policy, but valid for clarity if separated.
-- Merged into "HR/Admin can view all employees" for simplicity.

-- Ensure permissions are granted
GRANT ALL ON public.employees TO authenticated;
