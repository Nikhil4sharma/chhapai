-- ==========================================
-- Fix Employees RLS - Allow HR View
-- Updates policies to let HR and Admin view all employees
-- ==========================================

-- 1. Enable RLS (just in case)
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing restrictive policies
DROP POLICY IF EXISTS "Users can view own employee profile" ON public.employees;
DROP POLICY IF EXISTS "Admins can view all employees" ON public.employees;
DROP POLICY IF EXISTS "HR can view all employees" ON public.employees;
DROP POLICY IF EXISTS "Admin and HR can view all employees" ON public.employees;
DROP POLICY IF EXISTS "Admins can manage employees" ON public.employees;

-- 3. Policy: Self View
CREATE POLICY "Users can view own employee profile"
ON public.employees FOR SELECT
USING (auth.uid() = user_id);

-- 4. Policy: Admin & HR View All
-- Uses is_admin() or checks logic directly
CREATE POLICY "Admin and HR can view all employees"
ON public.employees FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND (ur.role = 'admin' OR ur.role = 'hr')
  )
);

-- 5. Policy: Admin Management (Insert/Update/Delete)
CREATE POLICY "Admins can manage employees"
ON public.employees FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role = 'admin'
  )
);

-- Note: HR might need update permissions later, but user asked for "view" fix specifically for now.
-- Verify roles exist for current user to avoid infinite recursion if policies are cross-dependent
-- (employees table does not depend on user_roles for RLS usually, but user_roles does)
