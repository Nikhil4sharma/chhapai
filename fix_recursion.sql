-- Fix for Infinite Recursion in RLS (v6)
-- Concept: Use a SECURITY DEFINER function to check order_items access
-- This prevents the 'orders' policy from triggering 'order_items' RLS, breaking the loop.

-- 1. Create Helper Function (Bypasses RLS)
CREATE OR REPLACE FUNCTION public.fn_check_order_access_for_role(_order_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER -- Critical: Runs as Admin, ignores RLS on tables inside
SET search_path = public
AS $$
DECLARE
  _user_id uuid;
  _has_access boolean;
BEGIN
  _user_id := auth.uid();
  
  SELECT EXISTS (
    SELECT 1 FROM public.order_items oi
    WHERE oi.order_id = _order_id
    AND (
      -- A. Assigned directly
      oi.assigned_to = _user_id
      OR
      -- B. Matches Department/Role in user_roles
      EXISTS (
        SELECT 1 FROM public.user_roles ur 
        WHERE ur.user_id = _user_id 
        AND (
            LOWER(ur.role::text) = LOWER(oi.assigned_department) OR
            LOWER(ur.role::text) = LOWER(oi.current_stage)
        )
      )
      OR
      -- C. Matches Department in profiles
      EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.user_id = _user_id
        AND (
            LOWER(p.department) = LOWER(oi.assigned_department) OR
            LOWER(p.department) = LOWER(oi.current_stage)
        )
      )
    )
  ) INTO _has_access;

  RETURN _has_access;
END;
$$;

-- 2. DROP EXISTING POLICIES (Clean Slate)
DROP POLICY IF EXISTS "orders_access_policy_v7" ON public.orders;
DROP POLICY IF EXISTS "orders_access_policy_v6" ON public.orders;
DROP POLICY IF EXISTS "orders_access_policy_v5" ON public.orders;
-- ... (Dropping others as before to be safe)
DROP POLICY IF EXISTS "orders_select_inclusive" ON public.orders;
DROP POLICY IF EXISTS "orders_select_optimized" ON public.orders;
DROP POLICY IF EXISTS "orders_select_policy" ON public.orders;
DROP POLICY IF EXISTS "orders_design_access" ON public.orders;


-- 3. CREATE NEW ORDERS POLICY using the Function
CREATE POLICY "orders_access_policy_v8_recursive_fix"
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
  -- 3. Use Function to check items (Breaks Recursion)
  public.fn_check_order_access_for_role(orders.id)
);


-- 4. ORDER ITEMS POLICY (Can remain standard, as it doesn't query orders)
DROP POLICY IF EXISTS "order_items_access_policy_v7" ON public.order_items;
-- ... drop others

CREATE POLICY "order_items_access_policy_v8"
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
  -- 3. Department matches
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

-- 5. GRANT PERMISSIONS
GRANT SELECT ON public.orders TO authenticated;
GRANT SELECT ON public.order_items TO authenticated;
