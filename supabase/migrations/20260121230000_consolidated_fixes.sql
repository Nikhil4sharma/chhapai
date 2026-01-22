-- Consolidated Migration for Design Fix & Optimizations
-- Includes:
-- 1. Index Optimizations (from 20260121150000)
-- 2. Proforma RLS (from 20260121160000)
-- 3. Orders Update RLS (from 20260121170000)
-- 4. Prepress/Design RLS Fix (from 20260121200000 + force fix)

-- A. OPTIMIZATIONS (Safe subset)
CREATE INDEX IF NOT EXISTS idx_notifications_order_id ON public.notifications(order_id);
CREATE INDEX IF NOT EXISTS idx_notifications_customer_id ON public.notifications(customer_id);
CREATE INDEX IF NOT EXISTS idx_order_items_previous_assigned_to ON public.order_items(previous_assigned_to);

-- B. HELPER FUNCTION
CREATE OR REPLACE FUNCTION public.has_role(user_id uuid, role_name text)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE public.user_roles.user_id = user_id 
    AND LOWER(public.user_roles.role) = LOWER(role_name)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- C. ORDERS SELECT POLICY (CRITICAL FIX)
DROP POLICY IF EXISTS "orders_select_inclusive" ON public.orders;
DROP POLICY IF EXISTS "orders_select_optimized" ON public.orders;
DROP POLICY IF EXISTS "orders_select_policy" ON public.orders;
DROP POLICY IF EXISTS "orders_select_inclusive_v2" ON public.orders;

CREATE POLICY "orders_access_policy_v3"
ON public.orders FOR SELECT
TO authenticated
USING (
  -- 1. Admin/Sales/SuperAdmin/Accounts can view all
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = (select auth.uid()) 
    AND role IN ('admin', 'sales', 'super_admin', 'accounts')
  )
  OR 
  -- 2. Assigned directly to user
  (assigned_user = (select auth.uid()))
  OR
  -- 3. Has items assigned to user or their department
  EXISTS (
    SELECT 1 FROM public.order_items
    WHERE public.order_items.order_id = public.orders.id
    AND (
      public.order_items.assigned_to = (select auth.uid())
      OR
      EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = (select auth.uid())
        AND (
            LOWER(ur.role) = LOWER(public.order_items.assigned_department)
            OR
            LOWER(ur.role) = LOWER(public.order_items.current_stage)
            OR
            LOWER(ur.role) = LOWER(public.order_items.department)
        )
      )
    )
  )
);

-- D. ORDER ITEMS SELECT POLICY (CRITICAL FIX)
DROP POLICY IF EXISTS "order_items_select_inclusive" ON public.order_items;
DROP POLICY IF EXISTS "order_items_select_inclusive_v2" ON public.order_items;
DROP POLICY IF EXISTS "order_items_select_policy" ON public.order_items;
DROP POLICY IF EXISTS "view_order_items" ON public.order_items;
DROP POLICY IF EXISTS "order_items_read_policy" ON public.order_items;

CREATE POLICY "order_items_access_policy_v3"
ON public.order_items FOR SELECT
TO authenticated
USING (
  -- 1. Admin/Sales/SuperAdmin/Accounts can view all
  EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = (select auth.uid()) 
      AND role IN ('admin', 'sales', 'super_admin', 'accounts')
  )
  OR
  -- 2. Assigned directly to user
  assigned_to = (select auth.uid())
  OR
  -- 3. Visible to User's Department
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = (select auth.uid())
    AND (
        LOWER(ur.role) = LOWER(assigned_department)
        OR
        LOWER(ur.role) = LOWER(current_stage)
        OR
        LOWER(ur.role) = LOWER(department)
    )
  )
);

-- E. PROFORMA RLS
ALTER TABLE public.proforma_invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "proforma_invoices_select" ON public.proforma_invoices;
CREATE POLICY "proforma_invoices_select" ON public.proforma_invoices FOR SELECT TO authenticated
USING (
    created_by = (select auth.uid()) OR 
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = (select auth.uid()) AND role IN ('admin', 'super_admin'))
);

DROP POLICY IF EXISTS "proforma_invoices_delete" ON public.proforma_invoices;
CREATE POLICY "proforma_invoices_delete" ON public.proforma_invoices FOR DELETE TO authenticated
USING (
    created_by = (select auth.uid()) OR 
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = (select auth.uid()) AND role IN ('admin', 'super_admin'))
);

DROP POLICY IF EXISTS "proforma_invoices_update" ON public.proforma_invoices;
CREATE POLICY "proforma_invoices_update" ON public.proforma_invoices FOR UPDATE TO authenticated
USING (
    created_by = (select auth.uid()) OR 
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = (select auth.uid()) AND role IN ('admin', 'super_admin'))
)
WITH CHECK (
    created_by = (select auth.uid()) OR 
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = (select auth.uid()) AND role IN ('admin', 'super_admin'))
);
