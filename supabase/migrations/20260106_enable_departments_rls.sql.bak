-- Enable RLS on public.departments to fix "RLS Disabled in Public" security warning
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any (good practice)
DROP POLICY IF EXISTS "Allow read access to authenticated users" ON public.departments;
DROP POLICY IF EXISTS "Allow write access to admins only" ON public.departments;

-- Allow all authenticated users to read departments (needed for dropdowns, etc.)
CREATE POLICY "Allow read access to authenticated users"
ON public.departments
FOR SELECT
TO authenticated
USING (true);

-- Allow admins to manage departments (Insert/Update/Delete)
CREATE POLICY "Allow write access to admins only"
ON public.departments
FOR ALL
TO authenticated
USING (public.is_admin_safe())
WITH CHECK (public.is_admin_safe());

-- Comment to explain
COMMENT ON TABLE public.departments IS 'Reference table for departments. RLS enabled.';
