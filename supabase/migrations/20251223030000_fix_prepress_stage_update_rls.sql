-- Fix Prepress Stage Update RLS Permission Issue
-- 
-- ISSUE: Design users cannot update items from design to prepress stage
-- Error: "Permission denied: Cannot update item stage to prepress. new row violates row-level security policy"
--
-- ROOT CAUSE: The USING clause in RLS policy checks the OLD row (current state), but when design user
-- tries to update from design to prepress, the policy might not be allowing the transition properly.
--
-- FIX: Update the RLS policy to properly handle workflow transitions:
--   1. Design users can update items currently in design OR prepress (for reassignment)
--   2. Design users can assign items TO prepress (forward workflow)
--   3. Prepress users can update items currently in prepress OR items being assigned TO prepress

-- Fix order_items UPDATE RLS policy to properly handle prepress stage updates
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
  -- CRITICAL FIX: Allow design users to update items that are in design OR prepress
  -- This allows design users to move items from design to prepress, or reassign items in prepress
  OR (
    LOWER(COALESCE(get_user_department(auth.uid()), '')) = 'design'
    AND LOWER(COALESCE(assigned_department, '')) IN ('design', 'prepress')
  )
  -- CRITICAL FIX: Allow prepress users to update items that are in prepress OR design
  -- This allows prepress users to receive items from design department OR update items already in prepress
  OR (
    LOWER(COALESCE(get_user_department(auth.uid()), '')) = 'prepress'
    AND LOWER(COALESCE(assigned_department, '')) IN ('prepress', 'design', 'production')
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
  -- Design users can assign to sales (backward), design (same), or prepress (forward)
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
USING clause allows design users to update items in design OR prepress (for forward workflow). 
WITH CHECK clause allows design users to assign items TO prepress (forward workflow).';

