-- Fix Design Team Order Edit Permissions
-- 
-- ISSUE: Design team ko order edit karne ka access nahi hai, aur is wajah se department bhi assign nahi kar pa rahe hain
-- 
-- ROOT CAUSE: Orders table ki RLS policy me design users ko permission nahi hai to update orders
-- jab order ka current_department abhi 'design' nahi hai, lekin order_items me items design department me hain
--
-- FIX: Orders table ki RLS policy update karo to allow design users to:
--   1. Update orders that have items in design department (even if current_department is not 'design' yet)
--   2. Update orders to set current_department to 'design' when assigning items to design

-- Fix orders table UPDATE RLS policy to allow design users to edit orders
DROP POLICY IF EXISTS "Sales and admin can update orders" ON public.orders;

CREATE POLICY "Sales and admin can update orders"
ON public.orders FOR UPDATE
TO authenticated
USING (
  -- Admin and Sales can update any order
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'sales'::app_role)
  -- OR user's department matches order's current_department
  OR (
    current_department IS NOT NULL
    AND LOWER(COALESCE(current_department, '')) = LOWER(COALESCE(get_user_department(auth.uid()), ''))
  )
  -- OR order has items in user's department (CRITICAL: This allows design users to edit orders with design items)
  OR EXISTS (
    SELECT 1 FROM public.order_items oi
    WHERE oi.order_id = orders.id
    AND LOWER(COALESCE(oi.assigned_department, '')) = LOWER(COALESCE(get_user_department(auth.uid()), ''))
  )
)
WITH CHECK (
  -- Admin and Sales can set any department
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'sales'::app_role)
  -- OR user can keep order in their department (allow same department assignment)
  OR (
    current_department IS NOT NULL
    AND LOWER(COALESCE(current_department, '')) = LOWER(COALESCE(get_user_department(auth.uid()), ''))
  )
  -- OR user can assign to next department in workflow (when assigning via order_items, this updates orders.current_department)
  OR (
    -- Design can assign to design (same), prepress, or production (forward)
    LOWER(COALESCE(get_user_department(auth.uid()), '')) = 'design'
    AND LOWER(COALESCE(current_department, '')) IN ('design', 'prepress', 'production')
  )
  OR (
    -- Prepress can assign to production, outsource, or back to design
    LOWER(COALESCE(get_user_department(auth.uid()), '')) = 'prepress'
    AND LOWER(COALESCE(current_department, '')) IN ('production', 'outsource', 'design', 'prepress')
  )
  OR (
    -- Production can assign to dispatch or back to prepress
    LOWER(COALESCE(get_user_department(auth.uid()), '')) = 'production'
    AND LOWER(COALESCE(current_department, '')) IN ('dispatch', 'prepress', 'production', 'dispatched')
  )
  -- CRITICAL: Allow users to update orders that have items in their department
  -- This allows design users to update order metadata even if current_department is not yet 'design'
  OR EXISTS (
    SELECT 1 FROM public.order_items oi
    WHERE oi.order_id = orders.id
    AND LOWER(COALESCE(oi.assigned_department, '')) = LOWER(COALESCE(get_user_department(auth.uid()), ''))
  )
);

-- Add comment for documentation
COMMENT ON POLICY "Sales and admin can update orders" ON public.orders IS 
'Allows Sales/Admin to update any order, or department users to update orders that have items in their department. This enables design users to edit orders and assign departments even when order current_department is not yet set to their department.';

