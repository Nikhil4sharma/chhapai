-- Complete RLS Policy Fix for order_items Table
-- 
-- This migration ensures ALL RLS policies for order_items are properly configured
-- to allow workflow-based department transitions while maintaining security.
--
-- ISSUES FIXED:
-- 1. Design users cannot assign items to prepress/sales
-- 2. Prepress users cannot receive items from design
-- 3. Production users cannot receive items from prepress
-- 4. Workflow transitions blocked by RLS policies

-- ============================================================================
-- STEP 1: Ensure RLS is enabled
-- ============================================================================
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 2: Drop all existing policies to start fresh
-- ============================================================================
DROP POLICY IF EXISTS "Users can view items based on department" ON public.order_items;
DROP POLICY IF EXISTS "Users can update items in their department" ON public.order_items;
DROP POLICY IF EXISTS "Sales and admin can create items" ON public.order_items;
DROP POLICY IF EXISTS "Admins can delete items" ON public.order_items;
DROP POLICY IF EXISTS "Public can view order_items for tracking" ON public.order_items;

-- ============================================================================
-- STEP 3: SELECT Policy - Who can VIEW order_items
-- ============================================================================
CREATE POLICY "Users can view items based on department"
ON public.order_items
FOR SELECT
TO authenticated
USING (
  -- Admin can view all items
  has_role(auth.uid(), 'admin'::app_role)
  -- Sales can view all items
  OR has_role(auth.uid(), 'sales'::app_role)
  -- Users can view items in their department
  OR (
    LOWER(COALESCE(assigned_department, '')) = LOWER(COALESCE(get_user_department(auth.uid()), ''))
  )
  -- Design users can also view items in prepress (for workflow visibility)
  OR (
    LOWER(COALESCE(get_user_department(auth.uid()), '')) = 'design'
    AND LOWER(COALESCE(assigned_department, '')) IN ('prepress', 'sales')
  )
  -- Prepress users can also view items in design and production (for workflow visibility)
  OR (
    LOWER(COALESCE(get_user_department(auth.uid()), '')) = 'prepress'
    AND LOWER(COALESCE(assigned_department, '')) IN ('design', 'sales', 'production')
  )
  -- Production users can also view items in prepress (for workflow visibility)
  OR (
    LOWER(COALESCE(get_user_department(auth.uid()), '')) = 'production'
    AND LOWER(COALESCE(assigned_department, '')) IN ('prepress')
  )
);

-- ============================================================================
-- STEP 4: INSERT Policy - Who can CREATE order_items
-- ============================================================================
CREATE POLICY "Sales and admin can create items"
ON public.order_items
FOR INSERT
TO authenticated
WITH CHECK (
  -- Admin can create items
  has_role(auth.uid(), 'admin'::app_role)
  -- Sales can create items
  OR has_role(auth.uid(), 'sales'::app_role)
);

-- ============================================================================
-- STEP 5: UPDATE Policy - Who can MODIFY order_items (CRITICAL FIX)
-- ============================================================================
CREATE POLICY "Users can update items in their department"
ON public.order_items
FOR UPDATE
TO authenticated
USING (
  -- Admin can update any item
  has_role(auth.uid(), 'admin'::app_role)
  -- Sales can update any item
  OR has_role(auth.uid(), 'sales'::app_role)
  -- Users can update items currently in their department
  OR (
    LOWER(COALESCE(assigned_department, '')) = LOWER(COALESCE(get_user_department(auth.uid()), ''))
  )
  -- CRITICAL FIX: Design users can update items in design, prepress, OR sales
  -- This allows:
  --   - Moving items from design to prepress (forward workflow)
  --   - Moving items from design to sales (backward workflow)
  --   - Reassigning items already in prepress or sales
  OR (
    LOWER(COALESCE(get_user_department(auth.uid()), '')) = 'design'
    AND LOWER(COALESCE(assigned_department, '')) IN ('design', 'prepress', 'sales')
  )
  -- CRITICAL FIX: Prepress users can update items in prepress, design, sales, OR production
  -- This allows:
  --   - Receiving items from design/sales
  --   - Moving items to production (forward workflow)
  --   - Reassigning items back to design/sales (backward workflow)
  OR (
    LOWER(COALESCE(get_user_department(auth.uid()), '')) = 'prepress'
    AND LOWER(COALESCE(assigned_department, '')) IN ('prepress', 'design', 'sales', 'production')
  )
  -- Production users can update items in production or prepress
  -- This allows:
  --   - Receiving items from prepress
  --   - Reassigning items back to prepress (backward workflow)
  OR (
    LOWER(COALESCE(get_user_department(auth.uid()), '')) = 'production'
    AND LOWER(COALESCE(assigned_department, '')) IN ('production', 'prepress')
  )
)
WITH CHECK (
  -- Admin can assign to ANY department
  has_role(auth.uid(), 'admin'::app_role)
  -- Sales can assign to ALL workflow departments
  OR (
    has_role(auth.uid(), 'sales'::app_role)
    AND LOWER(COALESCE(assigned_department, '')) IN ('sales', 'design', 'prepress', 'production', 'outsource', 'dispatch', 'dispatched', 'completed')
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
  -- CRITICAL: Allow users to keep items in their own department (for other field updates)
  -- This is important for updating current_stage, current_substage, priority, etc. without changing department
  OR (
    LOWER(COALESCE(assigned_department, '')) = LOWER(COALESCE(get_user_department(auth.uid()), ''))
  )
);

-- ============================================================================
-- STEP 6: DELETE Policy - Who can DELETE order_items
-- ============================================================================
CREATE POLICY "Admins can delete items"
ON public.order_items
FOR DELETE
TO authenticated
USING (
  -- Only admins can delete items
  has_role(auth.uid(), 'admin'::app_role)
);

-- ============================================================================
-- STEP 7: Add comprehensive comments for documentation
-- ============================================================================
COMMENT ON POLICY "Users can view items based on department" ON public.order_items IS 
'Allows users to view order_items in their department plus adjacent departments for workflow visibility. 
Admin and Sales can view all items.';

COMMENT ON POLICY "Sales and admin can create items" ON public.order_items IS 
'Only Admin and Sales roles can create new order_items. This ensures order creation is controlled.';

COMMENT ON POLICY "Users can update items in their department" ON public.order_items IS 
'Allows workflow-based department transitions:
- USING clause: Checks if user can update the CURRENT item (OLD row)
  * Design users can update items in design, prepress, OR sales
  * Prepress users can update items in prepress, design, sales, OR production
  * Production users can update items in production OR prepress
- WITH CHECK clause: Validates the NEW department assignment (NEW row)
  * Design users can assign to sales (backward), design (same), or prepress (forward)
  * Prepress users can assign to sales/design (backward), prepress (same), or production/outsource (forward)
  * Production users can assign to prepress (backward), production (same), or dispatch/completed (forward)';

COMMENT ON POLICY "Admins can delete items" ON public.order_items IS 
'Only Admin role can delete order_items. This prevents accidental data loss.';

-- ============================================================================
-- STEP 8: Verify RLS is enabled (safety check)
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'order_items'
    AND rowsecurity = true
  ) THEN
    RAISE EXCEPTION 'RLS is not enabled on order_items table';
  END IF;
END $$;

