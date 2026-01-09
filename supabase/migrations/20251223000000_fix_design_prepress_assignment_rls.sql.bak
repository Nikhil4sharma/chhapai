-- Fix RLS policy for order_items to ensure Design can assign to Prepress
-- The issue: Design users cannot assign items to prepress department
-- Root cause: Case sensitivity or exact match issues in WITH CHECK clause

-- Drop existing policy
DROP POLICY IF EXISTS "Users can update items in their department" ON public.order_items;

-- Recreate policy with explicit case handling and better logic
CREATE POLICY "Users can update items in their department"
ON public.order_items
FOR UPDATE
TO authenticated
USING (
  -- Admin and Sales can update any item
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'sales'::app_role)
  -- OR user's department matches item's CURRENT assigned_department (before update)
  OR (
    LOWER(COALESCE(assigned_department, '')) = LOWER(COALESCE(get_user_department(auth.uid()), ''))
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
  -- CRITICAL: Use exact lowercase comparison
  OR (
    LOWER(TRIM(COALESCE(get_user_department(auth.uid()), ''))) = 'design'
    AND LOWER(TRIM(COALESCE(assigned_department, ''))) IN ('sales', 'design', 'prepress')
  )
  -- Prepress users can assign to sales, design (backward), outsource, or production (forward)
  OR (
    LOWER(TRIM(COALESCE(get_user_department(auth.uid()), ''))) = 'prepress'
    AND LOWER(TRIM(COALESCE(assigned_department, ''))) IN ('sales', 'design', 'prepress', 'outsource', 'production')
  )
  -- Production users can assign to prepress (backward), production (same), dispatch, or completed (forward)
  OR (
    LOWER(TRIM(COALESCE(get_user_department(auth.uid()), ''))) = 'production'
    AND LOWER(TRIM(COALESCE(assigned_department, ''))) IN ('prepress', 'production', 'dispatch', 'dispatched', 'completed')
  )
  -- CRITICAL: Allow users to keep items in their own department (for other field updates like current_stage, current_substage, etc.)
  -- This must be last to catch same-department updates
  OR (
    LOWER(TRIM(COALESCE(assigned_department, ''))) = LOWER(TRIM(COALESCE(get_user_department(auth.uid()), '')))
    AND LOWER(TRIM(COALESCE(assigned_department, ''))) != ''
  )
);

-- Add comment for documentation
COMMENT ON POLICY "Users can update items in their department" ON public.order_items IS 
'Allows Sales/Admin to update any item, or department users to update items in their assigned_department with workflow-based department transitions. Design can assign to prepress.';

