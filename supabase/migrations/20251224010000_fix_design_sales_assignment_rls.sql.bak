-- Fix Design Department Assignment to Sales/Prepress RLS Permission Issue
-- 
-- ISSUE: Design users cannot assign items to sales or prepress department
-- Error: "Permission denied: Cannot update item stage to prepress. new row violates row-level security policy"
--
-- ROOT CAUSE: The USING clause only allows design users to update items in design OR prepress,
-- but doesn't allow them to update items in sales department (for backward workflow).
-- Also, design users need to be able to update items in their own department to assign to sales/prepress.
--
-- FIX: Update the RLS policy to allow design users to:
--   1. Update items currently in design, prepress, OR sales (for backward/forward workflow)
--   2. Assign items TO sales, design, or prepress (workflow transitions)

-- Fix order_items UPDATE RLS policy to allow design users to assign to sales/prepress
DROP POLICY IF EXISTS "Users can update items in their department" ON public.order_items;

CREATE POLICY "Users can update items in their department"
ON public.order_items
FOR UPDATE
TO authenticated
USING (
  -- Admin and Sales can update any item
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'sales'::app_role)
  -- OR user's department matches item's CURRENT assigned_department (can update items in their department)
  OR (
    LOWER(COALESCE(assigned_department, '')) = LOWER(COALESCE(get_user_department(auth.uid()), ''))
  )
  -- CRITICAL FIX: Allow design users to update items that are in design, prepress, OR sales
  -- This allows design users to:
  --   - Move items from design to prepress (forward workflow)
  --   - Move items from design to sales (backward workflow)
  --   - Reassign items already in prepress or sales
  OR (
    LOWER(COALESCE(get_user_department(auth.uid()), '')) = 'design'
    AND LOWER(COALESCE(assigned_department, '')) IN ('design', 'prepress', 'sales')
  )
  -- CRITICAL FIX: Allow prepress users to update items that are in prepress, design, OR sales
  -- This allows prepress users to receive items from design/sales OR update items already in prepress
  OR (
    LOWER(COALESCE(get_user_department(auth.uid()), '')) = 'prepress'
    AND LOWER(COALESCE(assigned_department, '')) IN ('prepress', 'design', 'sales', 'production')
  )
  -- Production users can update items in production or being assigned to production from prepress
  OR (
    LOWER(COALESCE(get_user_department(auth.uid()), '')) = 'production'
    AND LOWER(COALESCE(assigned_department, '')) IN ('production', 'prepress')
  )
)
WITH CHECK (
  -- Admin can assign to ANY department
  has_role(auth.uid(), 'admin'::app_role)
  -- Sales can assign to ALL departments
  OR (
    has_role(auth.uid(), 'sales'::app_role)
    AND LOWER(COALESCE(assigned_department, '')) IN ('sales', 'design', 'prepress', 'production', 'outsource', 'dispatch', 'dispatched')
  )
  -- CRITICAL FIX: Design users can assign to sales (backward), design (same), or prepress (forward)
  OR (
    LOWER(COALESCE(get_user_department(auth.uid()), '')) = 'design'
    AND LOWER(COALESCE(assigned_department, '')) IN ('sales', 'design', 'prepress')
  )
  -- Prepress users can assign to sales, design (backward), prepress (same), outsource, or production (forward)
  OR (
    LOWER(COALESCE(get_user_department(auth.uid()), '')) = 'prepress'
    AND LOWER(COALESCE(assigned_department, '')) IN ('sales', 'design', 'prepress', 'outsource', 'production')
  )
  -- Production users can assign to prepress (backward), production (same), dispatch, or completed (forward)
  OR (
    LOWER(COALESCE(get_user_department(auth.uid()), '')) = 'production'
    AND LOWER(COALESCE(assigned_department, '')) IN ('prepress', 'production', 'dispatch', 'dispatched', 'completed')
  )
  -- CRITICAL: Allow users to keep items in their own department (for other field updates like current_stage, current_substage, etc.)
  OR (
    LOWER(COALESCE(assigned_department, '')) = LOWER(COALESCE(get_user_department(auth.uid()), ''))
  )
);

-- Add comment for documentation
COMMENT ON POLICY "Users can update items in their department" ON public.order_items IS 
'Allows Sales/Admin to update any item, or department users to update items in their assigned_department with workflow-based department transitions. 
USING clause allows design users to update items in design, prepress, OR sales (for backward/forward workflow). 
WITH CHECK clause allows design users to assign items TO sales (backward), design (same), or prepress (forward workflow).';

