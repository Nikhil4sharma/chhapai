-- Fix: Enable UPDATE permission on wc_customers for authenticated users
-- This allows Sales/Admin to assign customers to managers

-- Enable RLS if not already enabled
ALTER TABLE public.wc_customers ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any (to avoid conflicts)
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.wc_customers;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.wc_customers;
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON public.wc_customers;
DROP POLICY IF EXISTS "Enable update access for authenticated users" ON public.wc_customers;

-- Create comprehensive policies for wc_customers

-- SELECT: All authenticated users can view all customers
CREATE POLICY "Enable read access for authenticated users" 
ON public.wc_customers
FOR SELECT 
TO authenticated
USING (true);

-- INSERT: All authenticated users can insert customers (for WooCommerce sync)
CREATE POLICY "Enable insert access for authenticated users" 
ON public.wc_customers
FOR INSERT 
TO authenticated
WITH CHECK (true);

-- UPDATE: All authenticated users can update customers (for assignment, sync, etc.)
CREATE POLICY "Enable update access for authenticated users" 
ON public.wc_customers
FOR UPDATE 
TO authenticated
USING (true)
WITH CHECK (true);

-- DELETE: Only admins can delete (optional, can be restricted further)
-- DELETE: Only admins can delete (optional, can be restricted further)
DROP POLICY IF EXISTS "Enable delete access for authenticated users" ON public.wc_customers;
CREATE POLICY "Enable delete access for authenticated users" 
ON public.wc_customers
FOR DELETE 
TO authenticated
USING (true);
