-- Fix RLS policy for order_items UPDATE to allow department users to assign items to other departments
-- based on workflow rules.
-- 
-- Problem: Design/Prepress users couldn't assign items because:
-- 1. USING clause only allowed updates if item is in their department
-- 2. When assigning from design to prepress, the item is in 'design', so USING passes
-- 3. But WITH CHECK validates the NEW row, and needs to allow department changes
--
-- Solution: Use the same logic from migration 20251218130000 but ensure USING clause allows
-- users to update items in their department (which they can see via SELECT policy).

DROP POLICY IF EXISTS "Users can update items in their department" ON public.order_items;

CREATE POLICY "Users can update items in their department"
ON public.order_items
FOR UPDATE
TO authenticated
USING (
  -- Admin can update anything
  has_role(auth.uid(), 'admin'::app_role)
  -- Sales can update any items
  OR has_role(auth.uid(), 'sales'::app_role)
  -- Users can update items currently in their department (this is what they can see/access)
  OR (assigned_department = get_user_department(auth.uid()))
)
WITH CHECK (
  -- Admin can assign to ANY department
  has_role(auth.uid(), 'admin'::app_role)
  -- Sales can assign to ALL departments (sales, design, prepress, production, outsource, dispatch, dispatched)
  OR (
    has_role(auth.uid(), 'sales'::app_role)
    AND LOWER(assigned_department) IN ('sales', 'design', 'prepress', 'production', 'outsource', 'dispatch', 'dispatched')
  )
  -- Design users can assign to sales (backward), design (same), or prepress (forward)
  OR (
    LOWER(COALESCE(get_user_department(auth.uid()), '')) = 'design'
    AND LOWER(assigned_department) IN ('sales', 'design', 'prepress')
  )
  -- Prepress users can assign to sales, design (backward), outsource, or production (forward)
  OR (
    LOWER(COALESCE(get_user_department(auth.uid()), '')) = 'prepress'
    AND LOWER(assigned_department) IN ('sales', 'design', 'prepress', 'outsource', 'production')
  )
  -- Production users can assign to prepress (backward) or proceed to dispatch/dispatched (forward)
  OR (
    LOWER(COALESCE(get_user_department(auth.uid()), '')) = 'production'
    AND LOWER(assigned_department) IN ('prepress', 'production', 'dispatch', 'dispatched')
  )
  -- CRITICAL: Allow users to keep items in their own department (for other field updates)
  OR (
    LOWER(assigned_department) = LOWER(COALESCE(get_user_department(auth.uid()), ''))
  )
);

