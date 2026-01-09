-- Fix order_items INSERT policy to ensure it works correctly
-- The policy should allow sales and admin users to insert items
-- Also ensure the policy uses proper role checking

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Sales and admin can create items" ON public.order_items;

-- Recreate the INSERT policy
-- Note: Using string format for enum values (PostgreSQL auto-casts to app_role enum)
CREATE POLICY "Sales and admin can create items"
ON public.order_items 
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role) 
  OR public.has_role(auth.uid(), 'sales'::app_role)
);

