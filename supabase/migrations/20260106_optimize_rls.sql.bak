-- RLS Refactoring & Optimization: FINAL v7
-- Addresses:
-- 1. Infinite Recursion (42P17) -> Fixed via 'admin_users_secure' separate lookup table
--    (Breaks the query loop: user_roles -> policy -> check_admin -> admin_users_secure)
-- 2. Type Mismatches (42883) -> Fixed via DOUBLE-SIDED ::uuid casting
-- 3. Policy Consolidation -> Fixed by merging permissive policies

-- ============================================================================
-- 0. ADMIN LOOKUP INFRASTRUCTURE (RECURSION BREAKER)
-- ============================================================================

-- Create a secure table to store ONLY admin IDs. No RLS. Restricted access.
CREATE TABLE IF NOT EXISTS public.admin_users_secure (
    user_id UUID PRIMARY KEY
);

-- Lock it down: Only postgres/superuser/trigger can touch this.
-- Explicitly REVOKE from everyone else to be safe.
REVOKE ALL ON public.admin_users_secure FROM PUBLIC, authenticated, anon;

-- Function to sync user_roles -> admin_users_secure
CREATE OR REPLACE FUNCTION public.sync_admin_users_secure()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER -- Must be security definer to write to the locked table
SET search_path = public
AS $$
BEGIN
  -- Handle DELETE or UPDATE (removing admin)
  IF (TG_OP = 'DELETE') OR (TG_OP = 'UPDATE' AND OLD.role = 'admin'::app_role) THEN
    DELETE FROM public.admin_users_secure WHERE user_id = OLD.user_id::uuid;
  END IF;

  -- Handle INSERT or UPDATE (adding admin)
  IF (TG_OP = 'INSERT' AND NEW.role = 'admin'::app_role) OR 
     (TG_OP = 'UPDATE' AND NEW.role = 'admin'::app_role) THEN
    INSERT INTO public.admin_users_secure (user_id) 
    VALUES (NEW.user_id::uuid)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
  
  RETURN NULL;
END;
$$;

-- Trigger to keep it in sync
DROP TRIGGER IF EXISTS trigger_sync_admin_users ON public.user_roles;
CREATE TRIGGER trigger_sync_admin_users
  AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_admin_users_secure();

-- Initial Population (Idempotent)
INSERT INTO public.admin_users_secure (user_id)
SELECT user_id::uuid FROM public.user_roles WHERE role = 'admin'::app_role
ON CONFLICT (user_id) DO NOTHING;


-- ============================================================================
-- 1. SECURITY HELPER FUNCTIONS
-- ============================================================================

-- Safe Admin Check (No Param Version) - THE FIX
-- Queries admin_users_secure (No RLS) instead of user_roles (RLS)
CREATE OR REPLACE FUNCTION public.is_admin_safe()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.admin_users_secure 
    WHERE user_id = (select auth.uid())::uuid -- DOUBLE CAST
  );
END;
$$;
ALTER FUNCTION public.is_admin_safe() OWNER TO postgres;


-- Function to check if user is admin (Param Version)
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- We can use the secure table here too for speed/safety
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users_secure 
    WHERE user_id = is_admin._user_id::uuid
  );
$$;

-- Function to get user's primary department/role (Param Version)
CREATE OR REPLACE FUNCTION public.get_user_department(_user_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role::TEXT
  FROM public.user_roles
  WHERE user_roles.user_id::uuid = get_user_department._user_id::uuid -- DOUBLE CAST
  ORDER BY 
    CASE role
      WHEN 'admin'::app_role THEN 1
      WHEN 'sales'::app_role THEN 2
      ELSE 3
    END
  LIMIT 1;
$$;


-- REDEFINED public.can_view_order TO FIX UUID=TEXT INSIDE
CREATE OR REPLACE FUNCTION public.can_view_order(order_row public.orders, user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_dept TEXT;
  is_user_admin BOOLEAN;
  has_item_in_dept BOOLEAN;
BEGIN
  -- 1. Admin Check
  is_user_admin := public.is_admin(user_id);
  IF is_user_admin THEN
    RETURN true;
  END IF;

  -- 2. Get Department
  user_dept := LOWER(TRIM(public.get_user_department(user_id) || ''));
  
  -- 3. Legacy Sales Access
  IF user_dept = 'sales' THEN
    RETURN true;
  END IF;

  -- 4. Order-Level Assignment
  IF order_row.current_department IS NOT NULL THEN
    IF LOWER(TRIM(order_row.current_department || '')) = user_dept THEN
      IF order_row.assigned_user IS NULL OR order_row.assigned_user::uuid = user_id::uuid THEN
        RETURN true;
      END IF;
    END IF;
    RETURN false;
  END IF;

  -- 5. Fallback: Item-Level Assignment
  SELECT EXISTS (
    SELECT 1 FROM public.order_items oi
    WHERE oi.order_id::uuid = order_row.id::uuid -- DOUBLE CAST JOIN
      AND LOWER(TRIM(oi.assigned_department || '')) = user_dept
  ) INTO has_item_in_dept;

  RETURN has_item_in_dept;
END;
$$;


-- ============================================================================
-- 2. HR MODULE
-- ============================================================================

-- A. hr_employees
ALTER TABLE public.hr_employees ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "hr_employees_select" ON public.hr_employees;
DROP POLICY IF EXISTS "hr_employees_insert" ON public.hr_employees;
DROP POLICY IF EXISTS "hr_employees_update" ON public.hr_employees;
DROP POLICY IF EXISTS "hr_employees_delete" ON public.hr_employees;
-- Clean legacy
DROP POLICY IF EXISTS "HR Employees: View (Self, Admin, HR)" ON public.hr_employees;
DROP POLICY IF EXISTS "HR Employees: Manage (Admin, HR)" ON public.hr_employees;
DROP POLICY IF EXISTS "HR Employees: View (Self, Admin)" ON public.hr_employees;
DROP POLICY IF EXISTS "HR Employees: Manage (Admin)" ON public.hr_employees;
DROP POLICY IF EXISTS "HR Employees: Update (Admin)" ON public.hr_employees;
DROP POLICY IF EXISTS "HR Employees: Delete (Admin)" ON public.hr_employees;
DROP POLICY IF EXISTS "Users can view their own hr profile" ON public.hr_employees;
DROP POLICY IF EXISTS "Admins and HR can view all hr profiles" ON public.hr_employees;
DROP POLICY IF EXISTS "Admins and HR can manage hr profiles" ON public.hr_employees;

CREATE POLICY "hr_employees_select" ON public.hr_employees FOR SELECT TO authenticated USING (
  id::uuid = (select auth.uid())::uuid -- DOUBLE CAST
  OR public.is_admin_safe()
);

CREATE POLICY "hr_employees_insert" ON public.hr_employees FOR INSERT TO authenticated WITH CHECK (public.is_admin_safe());
CREATE POLICY "hr_employees_update" ON public.hr_employees FOR UPDATE TO authenticated USING (public.is_admin_safe());
CREATE POLICY "hr_employees_delete" ON public.hr_employees FOR DELETE TO authenticated USING (public.is_admin_safe());


-- B. hr_leaves
ALTER TABLE public.hr_leaves ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "hr_leaves_select" ON public.hr_leaves;
DROP POLICY IF EXISTS "hr_leaves_insert" ON public.hr_leaves;
DROP POLICY IF EXISTS "hr_leaves_update" ON public.hr_leaves;
DROP POLICY IF EXISTS "hr_leaves_delete" ON public.hr_leaves;
-- Legacy
DROP POLICY IF EXISTS "Users can view own leaves" ON public.hr_leaves;
DROP POLICY IF EXISTS "Admins can view all leaves" ON public.hr_leaves;
DROP POLICY IF EXISTS "Users can insert own leaves" ON public.hr_leaves;
DROP POLICY IF EXISTS "Admins can update leaves" ON public.hr_leaves;
DROP POLICY IF EXISTS "HR Leaves: View (Self or Admin)" ON public.hr_leaves;
DROP POLICY IF EXISTS "HR Leaves: Insert (Self)" ON public.hr_leaves;
DROP POLICY IF EXISTS "HR Leaves: Update (Admin/Self)" ON public.hr_leaves;

CREATE POLICY "hr_leaves_select" ON public.hr_leaves FOR SELECT TO authenticated USING (
  user_id::uuid = (select auth.uid())::uuid -- DOUBLE CAST
  OR public.is_admin_safe()
);

CREATE POLICY "hr_leaves_insert" ON public.hr_leaves FOR INSERT TO authenticated WITH CHECK (
  user_id::uuid = (select auth.uid())::uuid -- DOUBLE CAST
);

CREATE POLICY "hr_leaves_update" ON public.hr_leaves FOR UPDATE TO authenticated USING (
  user_id::uuid = (select auth.uid())::uuid -- DOUBLE CAST
  OR public.is_admin_safe()
);

CREATE POLICY "hr_leaves_delete" ON public.hr_leaves FOR DELETE TO authenticated USING (
  user_id::uuid = (select auth.uid())::uuid -- DOUBLE CAST
  OR public.is_admin_safe()
);


-- C. hr_payroll_records
ALTER TABLE public.hr_payroll_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "hr_payroll_select" ON public.hr_payroll_records;
DROP POLICY IF EXISTS "hr_payroll_insert" ON public.hr_payroll_records;
DROP POLICY IF EXISTS "hr_payroll_update" ON public.hr_payroll_records;
DROP POLICY IF EXISTS "hr_payroll_delete" ON public.hr_payroll_records;
-- Legacy
DROP POLICY IF EXISTS "Users can view own payroll" ON public.hr_payroll_records;
DROP POLICY IF EXISTS "Admins can manage payroll" ON public.hr_payroll_records;
DROP POLICY IF EXISTS "HR Payroll: View (Self or Admin)" ON public.hr_payroll_records;
DROP POLICY IF EXISTS "HR Payroll: Manage (Admin)" ON public.hr_payroll_records;

CREATE POLICY "hr_payroll_select" ON public.hr_payroll_records FOR SELECT TO authenticated USING (
  user_id::uuid = (select auth.uid())::uuid
  OR public.is_admin_safe()
);

CREATE POLICY "hr_payroll_insert" ON public.hr_payroll_records FOR INSERT TO authenticated WITH CHECK (public.is_admin_safe());
CREATE POLICY "hr_payroll_update" ON public.hr_payroll_records FOR UPDATE TO authenticated USING (public.is_admin_safe());
CREATE POLICY "hr_payroll_delete" ON public.hr_payroll_records FOR DELETE TO authenticated USING (public.is_admin_safe());


-- D. hr_holidays & hr_leave_types
ALTER TABLE public.hr_holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_leave_types ENABLE ROW LEVEL SECURITY;
-- Cleanup & Recreate
DROP POLICY IF EXISTS "hr_holidays_select" ON public.hr_holidays;
DROP POLICY IF EXISTS "hr_holidays_insert" ON public.hr_holidays;
DROP POLICY IF EXISTS "hr_holidays_update" ON public.hr_holidays;
DROP POLICY IF EXISTS "hr_holidays_delete" ON public.hr_holidays;
DROP POLICY IF EXISTS "Everyone can view holidays" ON public.hr_holidays;
DROP POLICY IF EXISTS "Admins can manage holidays" ON public.hr_holidays;
CREATE POLICY "hr_holidays_select" ON public.hr_holidays FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "hr_holidays_insert" ON public.hr_holidays FOR INSERT TO authenticated WITH CHECK (public.is_admin_safe());
CREATE POLICY "hr_holidays_update" ON public.hr_holidays FOR UPDATE TO authenticated USING (public.is_admin_safe());
CREATE POLICY "hr_holidays_delete" ON public.hr_holidays FOR DELETE TO authenticated USING (public.is_admin_safe());

DROP POLICY IF EXISTS "hr_leave_types_select" ON public.hr_leave_types;
DROP POLICY IF EXISTS "hr_leave_types_insert" ON public.hr_leave_types;
DROP POLICY IF EXISTS "hr_leave_types_update" ON public.hr_leave_types;
DROP POLICY IF EXISTS "hr_leave_types_delete" ON public.hr_leave_types;
DROP POLICY IF EXISTS "Everyone can view leave types" ON public.hr_leave_types;
DROP POLICY IF EXISTS "Admins can manage leave types" ON public.hr_leave_types;
CREATE POLICY "hr_leave_types_select" ON public.hr_leave_types FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "hr_leave_types_insert" ON public.hr_leave_types FOR INSERT TO authenticated WITH CHECK (public.is_admin_safe());
CREATE POLICY "hr_leave_types_update" ON public.hr_leave_types FOR UPDATE TO authenticated USING (public.is_admin_safe());
CREATE POLICY "hr_leave_types_delete" ON public.hr_leave_types FOR DELETE TO authenticated USING (public.is_admin_safe());


-- E. hr_leave_balances
ALTER TABLE public.hr_leave_balances ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "hr_balances_select" ON public.hr_leave_balances;
DROP POLICY IF EXISTS "hr_balances_insert" ON public.hr_leave_balances;
DROP POLICY IF EXISTS "hr_balances_update" ON public.hr_leave_balances;
DROP POLICY IF EXISTS "hr_balances_delete" ON public.hr_leave_balances;
-- Legacy
DROP POLICY IF EXISTS "Users can view their own leave balances" ON public.hr_leave_balances;
DROP POLICY IF EXISTS "Admins can view all leave balances" ON public.hr_leave_balances;
DROP POLICY IF EXISTS "Admins can manage leave balances" ON public.hr_leave_balances;

CREATE POLICY "hr_balances_select" ON public.hr_leave_balances FOR SELECT TO authenticated USING (
  user_id::uuid = (select auth.uid())::uuid
  OR public.is_admin_safe()
);

CREATE POLICY "hr_balances_insert" ON public.hr_leave_balances FOR INSERT TO authenticated WITH CHECK (public.is_admin_safe());
CREATE POLICY "hr_balances_update" ON public.hr_leave_balances FOR UPDATE TO authenticated USING (public.is_admin_safe());
CREATE POLICY "hr_balances_delete" ON public.hr_leave_balances FOR DELETE TO authenticated USING (public.is_admin_safe());


-- ============================================================================
-- 3. INVENTORY & VENDORS
-- ============================================================================
-- Paper Inventory
ALTER TABLE public.paper_inventory ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "paper_inventory_select" ON public.paper_inventory;
DROP POLICY IF EXISTS "paper_inventory_insert" ON public.paper_inventory;
DROP POLICY IF EXISTS "paper_inventory_update" ON public.paper_inventory;
DROP POLICY IF EXISTS "paper_inventory_delete" ON public.paper_inventory;
DROP POLICY IF EXISTS "Admins have full access to paper_inventory" ON public.paper_inventory;
DROP POLICY IF EXISTS "Staff read paper_inventory" ON public.paper_inventory;
CREATE POLICY "paper_inventory_select" ON public.paper_inventory FOR SELECT TO authenticated USING (true);
CREATE POLICY "paper_inventory_insert" ON public.paper_inventory FOR INSERT TO authenticated WITH CHECK (public.is_admin_safe());
CREATE POLICY "paper_inventory_update" ON public.paper_inventory FOR UPDATE TO authenticated USING (public.is_admin_safe());
CREATE POLICY "paper_inventory_delete" ON public.paper_inventory FOR DELETE TO authenticated USING (public.is_admin_safe());

-- Inventory Transactions
ALTER TABLE public.inventory_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "inv_transactions_select" ON public.inventory_transactions;
DROP POLICY IF EXISTS "inv_transactions_insert" ON public.inventory_transactions;
DROP POLICY IF EXISTS "Admins have full access to transactions" ON public.inventory_transactions;
DROP POLICY IF EXISTS "Production create transactions" ON public.inventory_transactions;
CREATE POLICY "inv_transactions_select" ON public.inventory_transactions FOR SELECT TO authenticated USING (public.is_admin_safe());
CREATE POLICY "inv_transactions_insert" ON public.inventory_transactions FOR INSERT TO authenticated WITH CHECK (true);

-- Job Materials
ALTER TABLE public.job_materials ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "job_materials_all" ON public.job_materials;
DROP POLICY IF EXISTS "Admins have full access to job_materials" ON public.job_materials;
DROP POLICY IF EXISTS "Staff manage job_materials" ON public.job_materials;
CREATE POLICY "job_materials_all" ON public.job_materials FOR ALL TO authenticated USING (true);

-- Vendors
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "vendors_select" ON public.vendors;
DROP POLICY IF EXISTS "vendors_insert" ON public.vendors;
DROP POLICY IF EXISTS "vendors_update" ON public.vendors;
DROP POLICY IF EXISTS "vendors_delete" ON public.vendors;
DROP POLICY IF EXISTS "Users can view vendors" ON public.vendors;
DROP POLICY IF EXISTS "Admin can manage all vendors" ON public.vendors;
CREATE POLICY "vendors_select" ON public.vendors FOR SELECT TO authenticated USING (true);
CREATE POLICY "vendors_insert" ON public.vendors FOR INSERT TO authenticated WITH CHECK (public.is_admin_safe());
CREATE POLICY "vendors_update" ON public.vendors FOR UPDATE TO authenticated USING (public.is_admin_safe());
CREATE POLICY "vendors_delete" ON public.vendors FOR DELETE TO authenticated USING (public.is_admin_safe());


-- ============================================================================
-- 4. CORE MODULE
-- ============================================================================

-- A. user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_roles_select" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_insert" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_update" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_delete" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Authenticated users can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Authenticated users can view all roles for team assignment" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can delete roles" ON public.user_roles;


CREATE POLICY "user_roles_select" ON public.user_roles FOR SELECT TO authenticated USING (
  user_id::uuid = (select auth.uid())::uuid
  OR public.is_admin_safe()
);
CREATE POLICY "user_roles_insert" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.is_admin_safe());
CREATE POLICY "user_roles_update" ON public.user_roles FOR UPDATE TO authenticated USING (public.is_admin_safe());
CREATE POLICY "user_roles_delete" ON public.user_roles FOR DELETE TO authenticated USING (public.is_admin_safe());


-- B. profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can delete profiles" ON public.profiles;


CREATE POLICY "profiles_select" ON public.profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (
  user_id::uuid = (select auth.uid())::uuid
  OR public.is_admin_safe()
);

CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE TO authenticated USING (
  user_id::uuid = (select auth.uid())::uuid
  OR public.is_admin_safe()
);

CREATE POLICY "profiles_delete" ON public.profiles FOR DELETE TO authenticated USING (public.is_admin_safe());


-- C. wc_customers
ALTER TABLE public.wc_customers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "wc_customers_select" ON public.wc_customers;
DROP POLICY IF EXISTS "wc_customers_insert" ON public.wc_customers;
DROP POLICY IF EXISTS "wc_customers_update" ON public.wc_customers;
DROP POLICY IF EXISTS "wc_customers_delete" ON public.wc_customers;
DROP POLICY IF EXISTS "Allow delete access to assigned users" ON public.wc_customers;
DROP POLICY IF EXISTS "Allow admin full access" ON public.wc_customers;
DROP POLICY IF EXISTS "Allow read access to assigned users" ON public.wc_customers;

CREATE POLICY "wc_customers_select" ON public.wc_customers FOR SELECT TO authenticated USING (
  assigned_to::uuid = (select auth.uid())::uuid
  OR public.is_admin_safe()
);
CREATE POLICY "wc_customers_insert" ON public.wc_customers FOR INSERT TO authenticated WITH CHECK (public.is_admin_safe());
CREATE POLICY "wc_customers_update" ON public.wc_customers FOR UPDATE TO authenticated USING (public.is_admin_safe());
CREATE POLICY "wc_customers_delete" ON public.wc_customers FOR DELETE TO authenticated USING (public.is_admin_safe());


-- D. woocommerce_imports
ALTER TABLE public.woocommerce_imports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "wc_imports_select" ON public.woocommerce_imports;
DROP POLICY IF EXISTS "wc_imports_insert" ON public.woocommerce_imports;
DROP POLICY IF EXISTS "wc_imports_update" ON public.woocommerce_imports;
DROP POLICY IF EXISTS "wc_imports_delete" ON public.woocommerce_imports;
DROP POLICY IF EXISTS "Only admins can delete imports" ON public.woocommerce_imports;
DROP POLICY IF EXISTS "Users can view their own imports" ON public.woocommerce_imports;

CREATE POLICY "wc_imports_select" ON public.woocommerce_imports FOR SELECT TO authenticated USING (
  imported_by::uuid = (select auth.uid())::uuid
  OR public.is_admin_safe()
  OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id::uuid = (select auth.uid())::uuid AND role = 'sales'::app_role)
);
CREATE POLICY "wc_imports_insert" ON public.woocommerce_imports FOR INSERT TO authenticated WITH CHECK (
  public.is_admin_safe()
  OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id::uuid = (select auth.uid())::uuid AND role = 'sales'::app_role)
);
CREATE POLICY "wc_imports_update" ON public.woocommerce_imports FOR UPDATE TO authenticated USING (
  public.is_admin_safe()
  OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id::uuid = (select auth.uid())::uuid AND role = 'sales'::app_role)
);
CREATE POLICY "wc_imports_delete" ON public.woocommerce_imports FOR DELETE TO authenticated USING (
  public.is_admin_safe()
  OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id::uuid = (select auth.uid())::uuid AND role = 'sales'::app_role)
);


-- E. orders
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "orders_select" ON public.orders;
DROP POLICY IF EXISTS "orders_insert" ON public.orders;
DROP POLICY IF EXISTS "orders_update" ON public.orders;
DROP POLICY IF EXISTS "orders_delete" ON public.orders;
DROP POLICY IF EXISTS "Users can view orders based on department" ON public.orders;
DROP POLICY IF EXISTS "Sales and admin can create orders" ON public.orders;
DROP POLICY IF EXISTS "Sales and admin can update orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can delete orders" ON public.orders;


-- orders RLS uses can_view_order which correctly double-casts now
CREATE POLICY "orders_select" ON public.orders FOR SELECT TO authenticated USING (
  public.is_admin_safe()
  OR public.can_view_order(orders, (select auth.uid())::uuid)
);
CREATE POLICY "orders_insert" ON public.orders FOR INSERT TO authenticated WITH CHECK (
  public.is_admin_safe()
  OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id::uuid = (select auth.uid())::uuid AND role = 'sales'::app_role)
);
CREATE POLICY "orders_update" ON public.orders FOR UPDATE TO authenticated USING (
  public.is_admin_safe()
  OR public.can_view_order(orders, (select auth.uid())::uuid)
);
CREATE POLICY "orders_delete" ON public.orders FOR DELETE TO authenticated USING (public.is_admin_safe());


-- F. order_items
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "order_items_select" ON public.order_items;
DROP POLICY IF EXISTS "order_items_insert" ON public.order_items;
DROP POLICY IF EXISTS "order_items_update" ON public.order_items;
DROP POLICY IF EXISTS "order_items_delete" ON public.order_items;
DROP POLICY IF EXISTS "Admins and Sales view all items" ON public.order_items;
DROP POLICY IF EXISTS "Users can update items in their department" ON public.order_items;
DROP POLICY IF EXISTS "Users can view items based on department" ON public.order_items;
DROP POLICY IF EXISTS "Sales and admin can create items" ON public.order_items;
DROP POLICY IF EXISTS "Admins can delete items" ON public.order_items;


CREATE POLICY "order_items_select" ON public.order_items FOR SELECT TO authenticated USING (
  public.is_admin_safe()
  OR EXISTS (
      SELECT 1 FROM public.orders 
      WHERE id::uuid = order_id::uuid -- DOUBLE CAST JOIN
      AND public.can_view_order(orders, (select auth.uid())::uuid)
  )
);
CREATE POLICY "order_items_insert" ON public.order_items FOR INSERT TO authenticated WITH CHECK (
  public.is_admin_safe()
  OR EXISTS (
      SELECT 1 FROM public.orders 
      WHERE id::uuid = order_id::uuid -- DOUBLE CAST JOIN
      AND public.can_view_order(orders, (select auth.uid())::uuid)
  )
);
CREATE POLICY "order_items_update" ON public.order_items FOR UPDATE TO authenticated USING (
  public.is_admin_safe()
  OR EXISTS (
      SELECT 1 FROM public.orders 
      WHERE id::uuid = order_id::uuid -- DOUBLE CAST JOIN
      AND public.can_view_order(orders, (select auth.uid())::uuid)
  )
);
CREATE POLICY "order_items_delete" ON public.order_items FOR DELETE TO authenticated USING (public.is_admin_safe());


-- ============================================================================
-- 5. LOGS & SETTINGS
-- ============================================================================

-- A. user_work_logs
ALTER TABLE public.user_work_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "work_logs_all" ON public.user_work_logs;
DROP POLICY IF EXISTS "Work Logs: All (Self)" ON public.user_work_logs;
CREATE POLICY "work_logs_all" ON public.user_work_logs FOR ALL TO authenticated USING (
  user_id::uuid = (select auth.uid())::uuid
);

-- B. work_notes
ALTER TABLE public.work_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "work_notes_all" ON public.work_notes;
DROP POLICY IF EXISTS "Work Notes: All (Self)" ON public.work_notes;
CREATE POLICY "work_notes_all" ON public.work_notes FOR ALL TO authenticated USING (
  user_id::uuid = (select auth.uid())::uuid
);

-- C. timeline
ALTER TABLE public.timeline ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "timeline_select" ON public.timeline;
DROP POLICY IF EXISTS "timeline_insert" ON public.timeline;
DROP POLICY IF EXISTS "Timeline: View (Accessible)" ON public.timeline;

CREATE POLICY "timeline_select" ON public.timeline FOR SELECT TO authenticated USING (
  EXISTS (
     SELECT 1 FROM public.orders 
     WHERE id::uuid = order_id::uuid -- DOUBLE CAST
     AND (
       public.can_view_order(orders, (select auth.uid())::uuid)
       OR public.is_admin_safe()
     )
  )
);
CREATE POLICY "timeline_insert" ON public.timeline FOR INSERT TO authenticated WITH CHECK (
  EXISTS (
     SELECT 1 FROM public.orders 
     WHERE id::uuid = order_id::uuid -- DOUBLE CAST
     AND (
       public.can_view_order(orders, (select auth.uid())::uuid)
       OR public.is_admin_safe()
     )
  )
);

-- D. order_files
ALTER TABLE public.order_files ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "order_files_select" ON public.order_files;
DROP POLICY IF EXISTS "order_files_insert" ON public.order_files;
DROP POLICY IF EXISTS "order_files_delete" ON public.order_files;
DROP POLICY IF EXISTS "Order Files: View" ON public.order_files;

CREATE POLICY "order_files_select" ON public.order_files FOR SELECT TO authenticated USING (
  EXISTS (
     SELECT 1 FROM public.orders 
     WHERE id::uuid = order_id::uuid -- DOUBLE CAST
     AND (
       public.can_view_order(orders, (select auth.uid())::uuid)
       OR public.is_admin_safe()
     )
  )
);
CREATE POLICY "order_files_insert" ON public.order_files FOR INSERT TO authenticated WITH CHECK (
  EXISTS (
     SELECT 1 FROM public.orders 
     WHERE id::uuid = order_id::uuid -- DOUBLE CAST
     AND (
       public.can_view_order(orders, (select auth.uid())::uuid)
       OR public.is_admin_safe()
     )
  )
);
CREATE POLICY "order_files_delete" ON public.order_files FOR DELETE TO authenticated USING (
  uploaded_by::uuid = (select auth.uid())::uuid
  OR public.is_admin_safe()
);

-- E. order_activity_logs
ALTER TABLE public.order_activity_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "order_logs_select" ON public.order_activity_logs;
DROP POLICY IF EXISTS "order_logs_insert" ON public.order_activity_logs;
DROP POLICY IF EXISTS "Order Logs: View (Accessible)" ON public.order_activity_logs;

CREATE POLICY "order_logs_select" ON public.order_activity_logs FOR SELECT TO authenticated USING (
  EXISTS (
     SELECT 1 FROM public.orders 
     WHERE id::uuid = order_id::uuid -- DOUBLE CAST
     AND (
       public.can_view_order(orders, (select auth.uid())::uuid)
       OR public.is_admin_safe()
     )
  )
);
CREATE POLICY "order_logs_insert" ON public.order_activity_logs FOR INSERT TO authenticated WITH CHECK (true);

-- F. notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notifications_select" ON public.notifications;
DROP POLICY IF EXISTS "notifications_insert" ON public.notifications;
DROP POLICY IF EXISTS "notifications_update" ON public.notifications;
DROP POLICY IF EXISTS "notifications_delete" ON public.notifications;
DROP POLICY IF EXISTS "Notifications: View (Self)" ON public.notifications;

CREATE POLICY "notifications_select" ON public.notifications FOR SELECT TO authenticated USING (
  user_id::uuid = (select auth.uid())::uuid
);
CREATE POLICY "notifications_insert" ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "notifications_update" ON public.notifications FOR UPDATE TO authenticated USING (
  user_id::uuid = (select auth.uid())::uuid
);
CREATE POLICY "notifications_delete" ON public.notifications FOR DELETE TO authenticated USING (
  user_id::uuid = (select auth.uid())::uuid
);

-- G. settings
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_settings_all" ON public.user_settings;
DROP POLICY IF EXISTS "User Settings: All Access (Self)" ON public.user_settings;
CREATE POLICY "user_settings_all" ON public.user_settings FOR ALL TO authenticated USING (
  user_id::uuid = (select auth.uid())::uuid
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "app_settings_select" ON public.app_settings;
DROP POLICY IF EXISTS "app_settings_insert" ON public.app_settings;
DROP POLICY IF EXISTS "app_settings_update" ON public.app_settings;
DROP POLICY IF EXISTS "app_settings_delete" ON public.app_settings;
DROP POLICY IF EXISTS "App Settings: View (All)" ON public.app_settings;
CREATE POLICY "app_settings_select" ON public.app_settings FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "app_settings_insert" ON public.app_settings FOR INSERT TO authenticated WITH CHECK (public.is_admin_safe());
CREATE POLICY "app_settings_update" ON public.app_settings FOR UPDATE TO authenticated USING (public.is_admin_safe());
CREATE POLICY "app_settings_delete" ON public.app_settings FOR DELETE TO authenticated USING (public.is_admin_safe());

ALTER TABLE public.woocommerce_credentials ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "wc_creds_all" ON public.woocommerce_credentials;
DROP POLICY IF EXISTS "WC Creds: Manage (Admin)" ON public.woocommerce_credentials;
CREATE POLICY "wc_creds_all" ON public.woocommerce_credentials FOR ALL TO authenticated USING (public.is_admin_safe());
