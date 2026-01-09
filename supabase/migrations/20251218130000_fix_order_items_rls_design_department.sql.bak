-- Fix RLS policy for order_items with proper workflow-based department assignments
-- Workflow Rules:
-- 1. Sales & Admin: Can assign to ALL departments (sales, design, prepress, production, outsource, dispatch)
-- 2. Design: Can assign to sales, prepress (forward/backward)
-- 3. Prepress: Can assign to sales, design, outsource, production (forward/backward)
-- 4. Production: Can assign to prepress (backward only) or proceed to dispatch/dispatched

DROP POLICY IF EXISTS "Users can update items in their department" ON public.order_items;

CREATE POLICY "Users can update items in their department"
ON public.order_items
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (assigned_department = get_user_department(auth.uid()))
  OR has_role(auth.uid(), 'sales'::app_role)
)
WITH CHECK (
  -- Admins can assign to ANY department
  has_role(auth.uid(), 'admin'::app_role)
  -- Sales can assign to ALL departments (sales, design, prepress, production, outsource, dispatch, dispatched)
  OR (
    has_role(auth.uid(), 'sales'::app_role)
    AND LOWER(assigned_department) IN ('sales', 'design', 'prepress', 'production', 'outsource', 'dispatch', 'dispatched')
  )
  -- Design users can assign to sales (backward) or prepress (forward)
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
  -- CRITICAL: Allow users to keep items in their own department (case-insensitive)
  OR (
    LOWER(assigned_department) = LOWER(COALESCE(get_user_department(auth.uid()), ''))
  )
);

