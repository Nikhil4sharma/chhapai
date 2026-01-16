-- Create RLS policies for inventory_transactions table
-- Migration: 20260116160000_add_inventory_transactions_rls.sql

-- Enable RLS on inventory_transactions if not already enabled
ALTER TABLE public.inventory_transactions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "inventory_transactions_select_policy" ON public.inventory_transactions;
DROP POLICY IF EXISTS "inventory_transactions_insert_policy" ON public.inventory_transactions;
DROP POLICY IF EXISTS "inventory_transactions_update_policy" ON public.inventory_transactions;
DROP POLICY IF EXISTS "inventory_transactions_delete_policy" ON public.inventory_transactions;

-- Allow SELECT for Admin, Production, and Inventory departments
CREATE POLICY "inventory_transactions_select_policy"
ON public.inventory_transactions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.department IN ('admin', 'production', 'inventory')
  )
);

-- Allow INSERT for Admin, Production, and Inventory departments
CREATE POLICY "inventory_transactions_insert_policy"
ON public.inventory_transactions
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.department IN ('admin', 'production', 'inventory')
  )
);

-- Allow UPDATE for Admin only
CREATE POLICY "inventory_transactions_update_policy"
ON public.inventory_transactions
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.department = 'admin'
  )
);

-- Allow DELETE for Admin only
CREATE POLICY "inventory_transactions_delete_policy"
ON public.inventory_transactions
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.department = 'admin'
  )
);
