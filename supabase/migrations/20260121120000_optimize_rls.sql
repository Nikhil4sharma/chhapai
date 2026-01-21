-- Optimize RLS policies to use (select auth.uid()) for performance
-- This prevents per-row re-evaluation of auth functions

-- ============================================
-- 1. WC_CUSTOMERS
-- ============================================

-- Drop policies identified in tighten_rls_policies or potentially existing
DROP POLICY IF EXISTS "Sales and Admin can view customers" ON public.wc_customers;
DROP POLICY IF EXISTS "Sales and Admin can create customers" ON public.wc_customers;
DROP POLICY IF EXISTS "Sales and Admin can update customers" ON public.wc_customers;
DROP POLICY IF EXISTS "Admin can delete customers" ON public.wc_customers;

-- Also drop linter-identified policies if they exist by those names
DROP POLICY IF EXISTS "Admins and Ops can view all customers" ON public.wc_customers;
DROP POLICY IF EXISTS "Allow management of customers" ON public.wc_customers;
DROP POLICY IF EXISTS "Sales can view assigned or unassigned customers" ON public.wc_customers;

CREATE POLICY "wc_customers_select_optimized"
ON public.wc_customers FOR SELECT
TO authenticated
USING (
  (select auth.uid()) IN (
    SELECT user_id FROM public.user_roles 
    WHERE role IN ('sales', 'admin', 'accounts', 'super_admin')
  )
);

CREATE POLICY "wc_customers_insert_optimized"
ON public.wc_customers FOR INSERT
TO authenticated
WITH CHECK (
  (select auth.uid()) IN (
    SELECT user_id FROM public.user_roles 
    WHERE role IN ('sales', 'admin', 'super_admin')
  )
);

CREATE POLICY "wc_customers_update_optimized"
ON public.wc_customers FOR UPDATE
TO authenticated
USING (
  (select auth.uid()) IN (
    SELECT user_id FROM public.user_roles 
    WHERE role IN ('sales', 'admin', 'accounts', 'super_admin')
  )
)
WITH CHECK (
  (select auth.uid()) IN (
    SELECT user_id FROM public.user_roles 
    WHERE role IN ('sales', 'admin', 'accounts', 'super_admin')
  )
);

CREATE POLICY "wc_customers_delete_optimized"
ON public.wc_customers FOR DELETE
TO authenticated
USING (
  (select auth.uid()) IN (
    SELECT user_id FROM public.user_roles 
    WHERE role IN ('admin', 'super_admin')
  )
);

-- ============================================
-- 2. ORDERS
-- ============================================

DROP POLICY IF EXISTS "Orders: Create for sales and admin" ON public.orders;
DROP POLICY IF EXISTS "Orders: Delete admin only" ON public.orders;
DROP POLICY IF EXISTS "Orders: Update assigned user or admin" ON public.orders;
DROP POLICY IF EXISTS "Orders: View based on department and assignment" ON public.orders;
DROP POLICY IF EXISTS "Sales and Dispatch can update dispatch info" ON public.orders;
DROP POLICY IF EXISTS "safe_read_orders" ON public.orders;
DROP POLICY IF EXISTS "sales_create_orders" ON public.orders;

-- Read: Admin, Sales, or if assigned to user/department
CREATE POLICY "orders_select_optimized"
ON public.orders FOR SELECT
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = (select auth.uid()) AND role IN ('admin', 'sales', 'super_admin'))
  OR (assigned_user = (select auth.uid()))
  -- Check department association via helper (optimized)
  OR (
      current_department IS NOT NULL 
      AND LOWER(current_department) = LOWER(public.get_user_department((select auth.uid())))
  )
);

-- Insert: Admin, Sales
CREATE POLICY "orders_insert_optimized"
ON public.orders FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = (select auth.uid()) AND role IN ('admin', 'sales', 'super_admin'))
);

-- Update: Admin, Sales, or involved in workflow
CREATE POLICY "orders_update_optimized"
ON public.orders FOR UPDATE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = (select auth.uid()) AND role IN ('admin', 'sales', 'super_admin'))
  OR (
      current_department IS NOT NULL 
      AND LOWER(current_department) = LOWER(public.get_user_department((select auth.uid())))
  )
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = (select auth.uid()) AND role IN ('admin', 'sales', 'super_admin'))
  OR (
      current_department IS NOT NULL 
      AND LOWER(current_department) = LOWER(public.get_user_department((select auth.uid())))
  )
);

-- Delete: Admin only
CREATE POLICY "orders_delete_optimized"
ON public.orders FOR DELETE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = (select auth.uid()) AND role IN ('admin', 'super_admin'))
);

-- ============================================
-- 3. PROFILES
-- ============================================

DROP POLICY IF EXISTS "Manage Profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can manage own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "safe_modify_own_profile" ON public.profiles;

-- Anyone can read profiles (needed for assignment UI)
CREATE POLICY "profiles_select_optimized"
ON public.profiles FOR SELECT
TO authenticated
USING (true);

-- Update own profile or Admin
CREATE POLICY "profiles_update_optimized"
ON public.profiles FOR UPDATE
TO authenticated
USING (
  id = (select auth.uid()) 
  OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = (select auth.uid()) AND role IN ('admin', 'super_admin'))
)
WITH CHECK (
  id = (select auth.uid()) 
  OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = (select auth.uid()) AND role IN ('admin', 'super_admin'))
);

-- Insert usually handled by triggers, but allowing specific role logic if needed
CREATE POLICY "profiles_insert_optimized"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (
  id = (select auth.uid())
);

-- ============================================
-- 4. ORDER ACTIVITY LOGS
-- ============================================

DROP POLICY IF EXISTS "Users can view activity logs for accessible orders" ON public.order_activity_logs;
DROP POLICY IF EXISTS "Authenticated users can insert activity logs" ON public.order_activity_logs;
DROP POLICY IF EXISTS "order_logs_insert" ON public.order_activity_logs;
DROP POLICY IF EXISTS "safe_delete_activity_logs" ON public.order_activity_logs;
DROP POLICY IF EXISTS "safe_insert_activity_logs" ON public.order_activity_logs;
DROP POLICY IF EXISTS "safe_update_activity_logs" ON public.order_activity_logs;


CREATE POLICY "order_logs_select_optimized"
ON public.order_activity_logs FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_activity_logs.order_id
    AND (
      EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = (select auth.uid()) AND role IN ('admin', 'sales', 'super_admin'))
      OR (o.assigned_user = (select auth.uid()))
      OR (
          o.current_department IS NOT NULL 
          AND LOWER(o.current_department) = LOWER(public.get_user_department((select auth.uid())))
      )
    )
  )
);

CREATE POLICY "order_logs_insert_optimized"
ON public.order_activity_logs FOR INSERT
TO authenticated
WITH CHECK (true); -- Allow all authenticated to log activity (safe, mostly system generated or UI driven)

-- ============================================
-- 5. NOTIFICATIONS
-- ============================================

DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Notifications: Insert (Admin or System)" ON public.notifications;
DROP POLICY IF EXISTS "notifications_insert" ON public.notifications;

CREATE POLICY "notifications_select_optimized"
ON public.notifications FOR SELECT
TO authenticated
USING (
  user_id = (select auth.uid())
);

CREATE POLICY "notifications_update_optimized"
ON public.notifications FOR UPDATE
TO authenticated
USING (
  user_id = (select auth.uid())
);

CREATE POLICY "notifications_insert_optimized"
ON public.notifications FOR INSERT
TO authenticated
WITH CHECK (true); -- Allow system/triggers to insert

