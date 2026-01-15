-- ==========================================
-- Add Assigned Manager to Customers
-- Adds 'assigned_manager' column to wc_customers
-- ==========================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'wc_customers' AND column_name = 'assigned_manager') THEN
    ALTER TABLE public.wc_customers ADD COLUMN assigned_manager uuid REFERENCES auth.users(id);
  END IF;
END $$;

-- Fix RLS for Customers (Sales can only see assigned customers)
-- 1. Enable RLS
ALTER TABLE public.wc_customers ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies (to be safe)
DROP POLICY IF EXISTS "Allow sales to view assigned customers" ON public.wc_customers;
DROP POLICY IF EXISTS "Allow admins to view all customers" ON public.wc_customers;
DROP POLICY IF EXISTS "Allow everyone to insert customers" ON public.wc_customers; -- Or similar

-- 3. Create Policies
-- Admin/Super Admin/Production etc can view all (for operations)
CREATE POLICY "Admins and Ops can view all customers"
ON public.wc_customers FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('admin', 'super_admin', 'production', 'design', 'prepress', 'dispatch', 'outsource', 'hr', 'accounts')
  )
);

-- Sales can view ONLY their assigned customers OR customers they created (if we track created_by, but assigned is key here)
-- OR if no manager is assigned (unassigned pool)
CREATE POLICY "Sales can view assigned or unassigned customers"
ON public.wc_customers FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role = 'sales'
  )
  AND (
    assigned_manager = auth.uid() 
    OR assigned_manager IS NULL
  )
);

-- Allow Insert/Update for authenticated users (or restrict to sales/admin)
CREATE POLICY "Allow management of customers"
ON public.wc_customers FOR ALL
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');
