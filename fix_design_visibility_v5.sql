-- Robust Fix for Design Team Visibility (v5 - Final)
-- Fixed: Removed reference to invalid column 'department' in public.order_items
-- Fixed: Added ::text casting for Enum types
-- Fixed: Removed invalid 'role' column check in profiles

-- 1. DROP EXISTING POLICIES (Clean Slate)
DROP POLICY IF EXISTS "orders_select_inclusive" ON public.orders;
DROP POLICY IF EXISTS "orders_select_optimized" ON public.orders;
DROP POLICY IF EXISTS "orders_select_policy" ON public.orders;
DROP POLICY IF EXISTS "orders_select_inclusive_v2" ON public.orders;
DROP POLICY IF EXISTS "orders_access_policy_v3" ON public.orders;
DROP POLICY IF EXISTS "orders_design_access" ON public.orders;
DROP POLICY IF EXISTS "orders_access_policy_v4" ON public.orders;
DROP POLICY IF EXISTS "orders_access_policy_v5" ON public.orders;
DROP POLICY IF EXISTS "orders_access_policy_v6" ON public.orders;

-- 2. CREATE NEW ORDERS POLICY
CREATE POLICY "orders_access_policy_v7"
ON public.orders FOR SELECT
TO authenticated
USING (
  -- 1. Admin/Sales/SuperAdmin/Accounts can see ALL
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'sales', 'super_admin', 'accounts')
  )
  OR EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = auth.uid()
    AND (
      department IN ('admin', 'sales', 'super_admin', 'accounts')
    )
  )
  OR 
  -- 2. Order is assigned to specific user
  assigned_user = auth.uid()
  OR
  -- 3. Users can see orders containing items for their department/role/id
  EXISTS (
    SELECT 1 FROM public.order_items oi
    WHERE oi.order_id = orders.id
    AND (
      -- A. Assigned to specific user
      oi.assigned_to = auth.uid()
      OR
      -- B. Matches Department/Role in rules/profiles
      EXISTS (
        SELECT 1 FROM public.user_roles ur 
        WHERE ur.user_id = auth.uid() 
        AND (
            LOWER(ur.role::text) = LOWER(oi.assigned_department) OR
            LOWER(ur.role::text) = LOWER(oi.current_stage)
        )
      )
      OR
      EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.user_id = auth.uid()
        AND (
            LOWER(p.department) = LOWER(oi.assigned_department) OR
            LOWER(p.department) = LOWER(oi.current_stage)
        )
      )
    )
  )
);

-- 3. DROP EXISTING ITEM POLICIES
DROP POLICY IF EXISTS "order_items_select_inclusive" ON public.order_items;
DROP POLICY IF EXISTS "order_items_select_inclusive_v2" ON public.order_items;
DROP POLICY IF EXISTS "order_items_access_policy_v3" ON public.order_items;
DROP POLICY IF EXISTS "order_items_select_policy" ON public.order_items;
DROP POLICY IF EXISTS "view_order_items" ON public.order_items;
DROP POLICY IF EXISTS "order_items_design_access" ON public.order_items;
DROP POLICY IF EXISTS "order_items_access_policy_v4" ON public.order_items;
DROP POLICY IF EXISTS "order_items_access_policy_v5" ON public.order_items;
DROP POLICY IF EXISTS "order_items_access_policy_v6" ON public.order_items;

-- 4. CREATE NEW ITEMS POLICY
CREATE POLICY "order_items_access_policy_v7"
ON public.order_items FOR SELECT
TO authenticated
USING (
  -- 1. Admin/Sales/etc can see ALL
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'sales', 'super_admin', 'accounts')
  )
  OR EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = auth.uid()
    AND (
       department IN ('admin', 'sales', 'super_admin', 'accounts')
    )
  )
  OR
  -- 2. Assigned to user
  assigned_to = auth.uid()
  OR
  -- 3. Department matches (Check both user_roles and profiles)
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND (
      LOWER(ur.role::text) = LOWER(assigned_department) OR
      LOWER(ur.role::text) = LOWER(current_stage)
    )
  )
  OR
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid()
    AND (
      LOWER(p.department) = LOWER(assigned_department) OR
      LOWER(p.department) = LOWER(current_stage)
    )
  )
  OR
  -- 4. Allow Design to see items sent to Sales for approval
  (
    (assigned_department = 'sales' OR current_stage = 'sales')
    AND 
    (status = 'pending_for_customer_approval' OR status = 'pending_client_approval')
    AND
    need_design = true
    AND 
    (
        EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND department = 'design')
        OR
        EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text = 'design')
    )
  )
);

-- 5. RE-GRANT PERMISSIONS
GRANT SELECT ON public.orders TO authenticated;
GRANT SELECT ON public.order_items TO authenticated;
