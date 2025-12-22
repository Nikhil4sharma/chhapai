-- Fix RLS Permission for Prepress Stage Update & Add CASCADE DELETE for Activity Logs
-- 
-- ISSUES FIXED:
-- 1. Prepress users getting permission denied when updating items to prepress stage
-- 2. Order delete should also delete activity logs (CASCADE DELETE)
-- 3. Ensure proper workflow permissions for department transitions

-- Fix order_items UPDATE RLS policy to allow prepress users to update items to prepress
-- The issue is that when updating current_stage and assigned_department together,
-- the WITH CHECK clause needs to allow the transition
DROP POLICY IF EXISTS "Users can update items in their department" ON public.order_items;

CREATE POLICY "Users can update items in their department"
ON public.order_items
FOR UPDATE
TO authenticated
USING (
  -- Admin and Sales can update any item
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'sales'::app_role)
  -- OR user's department matches item's assigned_department (can update items in their department)
  OR (
    LOWER(COALESCE(assigned_department, '')) = LOWER(COALESCE(get_user_department(auth.uid()), ''))
  )
  -- OR user can update items that are being assigned TO their department (workflow forward)
  OR (
    -- Design users can update items being assigned to design or prepress
    LOWER(COALESCE(get_user_department(auth.uid()), '')) = 'design'
    AND LOWER(COALESCE(assigned_department, '')) IN ('design', 'prepress')
  )
  OR (
    -- Prepress users can update items being assigned to prepress, production, or outsource
    LOWER(COALESCE(get_user_department(auth.uid()), '')) = 'prepress'
    AND LOWER(COALESCE(assigned_department, '')) IN ('prepress', 'production', 'outsource')
  )
  OR (
    -- Production users can update items being assigned to production, dispatch, or dispatched
    LOWER(COALESCE(get_user_department(auth.uid()), '')) = 'production'
    AND LOWER(COALESCE(assigned_department, '')) IN ('production', 'dispatch', 'dispatched', 'completed')
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

-- Add CASCADE DELETE to order_activity_logs table
-- When an order is deleted, all its activity logs should be automatically deleted
DO $$
BEGIN
  -- Check if order_activity_logs table exists
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'order_activity_logs'
  ) THEN
    -- Drop existing foreign key constraint if it exists
    ALTER TABLE public.order_activity_logs 
    DROP CONSTRAINT IF EXISTS order_activity_logs_order_id_fkey;
    
    -- Recreate with CASCADE DELETE
    ALTER TABLE public.order_activity_logs
    ADD CONSTRAINT order_activity_logs_order_id_fkey
    FOREIGN KEY (order_id)
    REFERENCES public.orders(id)
    ON DELETE CASCADE;
    
    -- Also ensure item_id has CASCADE DELETE if it exists
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'order_activity_logs' 
      AND column_name = 'item_id'
    ) THEN
      ALTER TABLE public.order_activity_logs 
      DROP CONSTRAINT IF EXISTS order_activity_logs_item_id_fkey;
      
      ALTER TABLE public.order_activity_logs
      ADD CONSTRAINT order_activity_logs_item_id_fkey
      FOREIGN KEY (item_id)
      REFERENCES public.order_items(id)
      ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

-- Add comment for documentation
COMMENT ON POLICY "Users can update items in their department" ON public.order_items IS 
'Allows Sales/Admin to update any item, or department users to update items in their assigned_department with workflow-based department transitions. Includes USING clause to allow users to update items being assigned TO their department.';

