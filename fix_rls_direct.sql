-- Direct Fix for Design Dashboard RLS
-- Run this directly on the database

-- 1. Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "orders_select_inclusive" ON public.orders;
DROP POLICY IF EXISTS "orders_select_optimized" ON public.orders;
DROP POLICY IF EXISTS "orders_select_policy" ON public.orders;
DROP POLICY IF EXISTS "orders_select_inclusive_v2" ON public.orders;
DROP POLICY IF EXISTS "orders_access_policy_v3" ON public.orders;

-- 2. Create new permissive policy for orders
CREATE POLICY "orders_design_access"
ON public.orders FOR SELECT
TO authenticated
USING (
  -- Admin/Sales can see all
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'sales', 'super_admin', 'accounts')
  )
  OR 
  -- Order assigned to user
  assigned_user = auth.uid()
  OR
  -- Has items for this user or their department
  EXISTS (
    SELECT 1 FROM public.order_items oi
    LEFT JOIN public.user_roles ur ON ur.user_id = auth.uid()
    WHERE oi.order_id = orders.id
    AND (
      oi.assigned_to = auth.uid()
      OR LOWER(ur.role) = LOWER(oi.assigned_department)
      OR LOWER(ur.role) = LOWER(oi.current_stage)
      OR LOWER(ur.role) = LOWER(oi.department)
    )
  )
);

-- 3. Fix order_items policy
DROP POLICY IF EXISTS "order_items_select_inclusive" ON public.order_items;
DROP POLICY IF EXISTS "order_items_select_inclusive_v2" ON public.order_items;
DROP POLICY IF EXISTS "order_items_access_policy_v3" ON public.order_items;
DROP POLICY IF EXISTS "order_items_select_policy" ON public.order_items;
DROP POLICY IF EXISTS "view_order_items" ON public.order_items;

CREATE POLICY "order_items_design_access"
ON public.order_items FOR SELECT
TO authenticated
USING (
  -- Admin/Sales can see all
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'sales', 'super_admin', 'accounts')
  )
  OR
  -- Assigned to user
  assigned_to = auth.uid()
  OR
  -- User's department matches
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND (
      LOWER(ur.role) = LOWER(assigned_department)
      OR LOWER(ur.role) = LOWER(current_stage)
      OR LOWER(ur.role) = LOWER(department)
    )
  )
);
