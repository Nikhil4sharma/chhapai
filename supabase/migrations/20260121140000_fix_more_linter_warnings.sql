-- Fix remaining linter warnings (Round 2)
-- Includes: auth_rls_initplan (performance) and multiple_permissive_policies (redundancy)

-- ==============================================================================
-- 1. Optimizing auth.uid() calls -> (select auth.uid())
-- ==============================================================================

-- order_conversations
DROP POLICY IF EXISTS "Users can view their own conversations" ON public.order_conversations;
CREATE POLICY "Users can view their own conversations" ON public.order_conversations
    FOR SELECT TO authenticated
    USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can create conversations" ON public.order_conversations;
CREATE POLICY "Users can create conversations" ON public.order_conversations
    FOR INSERT TO authenticated
    WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update their own conversations" ON public.order_conversations;
CREATE POLICY "Users can update their own conversations" ON public.order_conversations
    FOR UPDATE TO authenticated
    USING (user_id = (select auth.uid()));


-- order_items
-- (Consolidating policies and optimizing)
DROP POLICY IF EXISTS "Order Items: View based on parent order" ON public.order_items;
DROP POLICY IF EXISTS "Order Items: Create for sales and admin" ON public.order_items;
DROP POLICY IF EXISTS "Order Items: Update if can view parent order" ON public.order_items;
DROP POLICY IF EXISTS "Order Items: Delete admin only" ON public.order_items;
DROP POLICY IF EXISTS "Enable update for sales users" ON public.order_items;
DROP POLICY IF EXISTS "Production can update their specific fields" ON public.order_items;
DROP POLICY IF EXISTS "safe_read_items" ON public.order_items;
DROP POLICY IF EXISTS "safe_write_items" ON public.order_items;
DROP POLICY IF EXISTS "safe_delete_items" ON public.order_items;

CREATE POLICY "order_items_select" ON public.order_items FOR SELECT TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.orders WHERE orders.id = order_items.order_id)
);

CREATE POLICY "order_items_insert" ON public.order_items FOR INSERT TO authenticated
WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = (select auth.uid()) AND role IN ('admin', 'super_admin', 'sales'))
);

CREATE POLICY "order_items_update" ON public.order_items FOR UPDATE TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.orders WHERE orders.id = order_items.order_id)
)
WITH CHECK (
    EXISTS (SELECT 1 FROM public.orders WHERE orders.id = order_items.order_id)
);

CREATE POLICY "order_items_delete" ON public.order_items FOR DELETE TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = (select auth.uid()) AND role IN ('admin', 'super_admin'))
);


-- order_activity
DROP POLICY IF EXISTS "Order Activity: View if can view order" ON public.order_activity;
CREATE POLICY "Order Activity: View if can view order" ON public.order_activity
    FOR SELECT TO authenticated
    USING (
         EXISTS (SELECT 1 FROM public.orders WHERE orders.id = order_activity.order_id)
    );

DROP POLICY IF EXISTS "Order Activity: Create if can view order" ON public.order_activity;
CREATE POLICY "Order Activity: Create if can view order" ON public.order_activity
    FOR INSERT TO authenticated
    WITH CHECK (
         EXISTS (SELECT 1 FROM public.orders WHERE orders.id = order_activity.order_id)
    );


-- order_files
-- (Consolidating and optimizing)
DROP POLICY IF EXISTS "Users can delete their own files" ON public.order_files;
DROP POLICY IF EXISTS "Authenticated users can upload files" ON public.order_files;
DROP POLICY IF EXISTS "Users can view files" ON public.order_files;
DROP POLICY IF EXISTS "order_files_delete" ON public.order_files;
DROP POLICY IF EXISTS "order_files_insert" ON public.order_files;
DROP POLICY IF EXISTS "order_files_select" ON public.order_files;
DROP POLICY IF EXISTS "order_files_insert_strict" ON public.order_files;

CREATE POLICY "order_files_select" ON public.order_files FOR SELECT TO authenticated USING (true);

CREATE POLICY "order_files_insert" ON public.order_files FOR INSERT TO authenticated
WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE POLICY "order_files_delete" ON public.order_files FOR DELETE TO authenticated
USING (uploaded_by = (select auth.uid()));


-- timeline
DROP POLICY IF EXISTS "Users can add timeline entries to accessible orders" ON public.timeline;
CREATE POLICY "timeline_insert" ON public.timeline FOR INSERT TO authenticated
WITH CHECK (
    EXISTS (SELECT 1 FROM public.orders WHERE orders.id = timeline.order_id)
);


-- user_work_logs
DROP POLICY IF EXISTS "Users can view their own work logs" ON public.user_work_logs;
CREATE POLICY "Users can view their own work logs" ON public.user_work_logs FOR SELECT TO authenticated
USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert their own work logs" ON public.user_work_logs;
CREATE POLICY "Users can insert their own work logs" ON public.user_work_logs FOR INSERT TO authenticated
WITH CHECK (user_id = (select auth.uid()));


-- work_notes
DROP POLICY IF EXISTS "Users can manage their own work notes" ON public.work_notes;
CREATE POLICY "Users can manage their own work notes" ON public.work_notes FOR ALL TO authenticated
USING (user_id = (select auth.uid()))
WITH CHECK (user_id = (select auth.uid()));


-- woocommerce_credentials
DROP POLICY IF EXISTS "Admin can manage WooCommerce credentials" ON public.woocommerce_credentials;
CREATE POLICY "Admin can manage WooCommerce credentials" ON public.woocommerce_credentials FOR ALL TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = (select auth.uid()) AND role IN ('admin', 'super_admin'))
)
WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = (select auth.uid()) AND role IN ('admin', 'super_admin'))
);


-- order_messages
DROP POLICY IF EXISTS "Users can view messages in their conversations" ON public.order_messages;
CREATE POLICY "Users can view messages in their conversations" ON public.order_messages FOR SELECT TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.order_conversations WHERE id = order_messages.conversation_id AND user_id = (select auth.uid()))
);

DROP POLICY IF EXISTS "Users can send messages to their conversations" ON public.order_messages;
CREATE POLICY "Users can send messages to their conversations" ON public.order_messages FOR INSERT TO authenticated
WITH CHECK (
    EXISTS (SELECT 1 FROM public.order_conversations WHERE id = order_messages.conversation_id AND user_id = (select auth.uid()))
);

DROP POLICY IF EXISTS "Users can update messages in their conversations" ON public.order_messages;
DROP POLICY IF EXISTS "Users can update their own messages" ON public.order_messages; -- Consolidating
CREATE POLICY "Users can update their own messages" ON public.order_messages FOR UPDATE TO authenticated
USING (sender_id = (select auth.uid()))
WITH CHECK (sender_id = (select auth.uid()));


-- sales_agent_mapping
DROP POLICY IF EXISTS "Allow admin to manage mappings" ON public.sales_agent_mapping;
CREATE POLICY "Allow admin to manage mappings" ON public.sales_agent_mapping FOR ALL TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = (select auth.uid()) AND role IN ('admin', 'super_admin'))
);


-- delay_reasons
DROP POLICY IF EXISTS "safe_update_delay_reasons" ON public.delay_reasons;
CREATE POLICY "delay_reasons_update_strict" ON public.delay_reasons FOR UPDATE TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = (select auth.uid()) AND role IN ('admin', 'super_admin', 'production'))
)
WITH CHECK (
     EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = (select auth.uid()) AND role IN ('admin', 'super_admin', 'production'))
);


-- proforma_invoices
DROP POLICY IF EXISTS "Allow insert proforma invoices for authenticated users" ON public.proforma_invoices;
CREATE POLICY "Allow insert proforma invoices for authenticated users" ON public.proforma_invoices FOR INSERT TO authenticated
WITH CHECK ((select auth.uid()) IS NOT NULL);


-- wc_customers
DROP POLICY IF EXISTS "Allow delete access to assigned users" ON public.wc_customers;
DROP POLICY IF EXISTS "Allow sales and admin to update customers" ON public.wc_customers;
DROP POLICY IF EXISTS "insert_wc_customers" ON public.wc_customers;

CREATE POLICY "wc_customers_delete" ON public.wc_customers FOR DELETE TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = (select auth.uid()) AND role IN ('admin', 'super_admin'))
);

CREATE POLICY "wc_customers_update" ON public.wc_customers FOR UPDATE TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = (select auth.uid()) AND role IN ('admin', 'super_admin', 'sales'))
)
WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = (select auth.uid()) AND role IN ('admin', 'super_admin', 'sales'))
);

CREATE POLICY "wc_customers_insert" ON public.wc_customers FOR INSERT TO authenticated
WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = (select auth.uid()) AND role IN ('admin', 'super_admin', 'sales'))
);


-- employees
-- (Consolidating and Optimizing)
DROP POLICY IF EXISTS "Users can view own employee profile" ON public.employees;
DROP POLICY IF EXISTS "Admin and HR can view all employees" ON public.employees;
DROP POLICY IF EXISTS "Admins can manage employees" ON public.employees;
DROP POLICY IF EXISTS "HR/Admin can view all employees" ON public.employees;
DROP POLICY IF EXISTS "HR/Admin can manage employees" ON public.employees;
DROP POLICY IF EXISTS "Users can view own employee record" ON public.employees;

CREATE POLICY "employees_select_own" ON public.employees FOR SELECT TO authenticated
USING (id = (select auth.uid()));

CREATE POLICY "employees_select_admin_hr" ON public.employees FOR SELECT TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = (select auth.uid()) AND role IN ('admin', 'super_admin', 'hr'))
);

CREATE POLICY "employees_manage_admin_hr" ON public.employees FOR ALL TO authenticated
USING (
     EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = (select auth.uid()) AND role IN ('admin', 'super_admin', 'hr'))
)
WITH CHECK (
     EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = (select auth.uid()) AND role IN ('admin', 'super_admin', 'hr'))
);


-- app_settings
DROP POLICY IF EXISTS "Enable insert for admins only" ON public.app_settings;
DROP POLICY IF EXISTS "Enable update for admins only" ON public.app_settings;
-- Redundant permissive ones
DROP POLICY IF EXISTS "Enable read access for all users" ON public.app_settings;
DROP POLICY IF EXISTS "app_settings_select" ON public.app_settings;
DROP POLICY IF EXISTS "app_settings_insert" ON public.app_settings;
DROP POLICY IF EXISTS "app_settings_update" ON public.app_settings;

CREATE POLICY "app_settings_select" ON public.app_settings FOR SELECT TO authenticated USING (true);

CREATE POLICY "app_settings_modify" ON public.app_settings FOR ALL TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = (select auth.uid()) AND role IN ('admin', 'super_admin'))
)
WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = (select auth.uid()) AND role IN ('admin', 'super_admin'))
);


-- hr_profiles
-- (Consolidating)
DROP POLICY IF EXISTS "Manage HR Profiles" ON public.hr_profiles;
DROP POLICY IF EXISTS "HR/Admin can view all profiles" ON public.hr_profiles;
DROP POLICY IF EXISTS "HR/Admin can update all profiles" ON public.hr_profiles;
DROP POLICY IF EXISTS "HR/Admin can insert profiles" ON public.hr_profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.hr_profiles;

CREATE POLICY "hr_profiles_view_own" ON public.hr_profiles FOR SELECT TO authenticated
USING (id = (select auth.uid()));

CREATE POLICY "hr_profiles_manage_admin_hr" ON public.hr_profiles FOR ALL TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = (select auth.uid()) AND role IN ('admin', 'super_admin', 'hr'))
)
WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = (select auth.uid()) AND role IN ('admin', 'super_admin', 'hr'))
);


-- hr_holidays
DROP POLICY IF EXISTS "HR Holidays: Manage (Admin)" ON public.hr_holidays;
DROP POLICY IF EXISTS "HR Holidays: View All" ON public.hr_holidays;
DROP POLICY IF EXISTS "hr_holidays_select" ON public.hr_holidays;
DROP POLICY IF EXISTS "hr_holidays_insert" ON public.hr_holidays;
DROP POLICY IF EXISTS "hr_holidays_update" ON public.hr_holidays;
DROP POLICY IF EXISTS "hr_holidays_delete" ON public.hr_holidays;

CREATE POLICY "hr_holidays_select" ON public.hr_holidays FOR SELECT TO authenticated USING (true);
CREATE POLICY "hr_holidays_manage" ON public.hr_holidays FOR ALL TO authenticated
USING (
     EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = (select auth.uid()) AND role IN ('admin', 'super_admin', 'hr'))
)
WITH CHECK (
     EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = (select auth.uid()) AND role IN ('admin', 'super_admin', 'hr'))
);


-- hr_leave_types / leave_types
-- (Consolidating)
DROP POLICY IF EXISTS "HR Leave Types: Manage (Admin)" ON public.hr_leave_types;
DROP POLICY IF EXISTS "HR Leave Types: View All" ON public.hr_leave_types;
DROP POLICY IF EXISTS "hr_leave_types_select" ON public.hr_leave_types;
DROP POLICY IF EXISTS "hr_leave_types_insert" ON public.hr_leave_types;
DROP POLICY IF EXISTS "hr_leave_types_update" ON public.hr_leave_types;
DROP POLICY IF EXISTS "hr_leave_types_delete" ON public.hr_leave_types;

CREATE POLICY "hr_leave_types_select" ON public.hr_leave_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "hr_leave_types_manage" ON public.hr_leave_types FOR ALL TO authenticated
USING (
     EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = (select auth.uid()) AND role IN ('admin', 'super_admin', 'hr'))
)
WITH CHECK (
     EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = (select auth.uid()) AND role IN ('admin', 'super_admin', 'hr'))
);


-- hr_leave_balances / leave_balances
-- (Consolidating)
DROP POLICY IF EXISTS "HR Balances: Manage (Admin)" ON public.hr_leave_balances;
DROP POLICY IF EXISTS "HR Balances: View (Self or Admin)" ON public.hr_leave_balances;
DROP POLICY IF EXISTS "hr_balances_select" ON public.hr_leave_balances;
DROP POLICY IF EXISTS "hr_balances_insert" ON public.hr_leave_balances;
DROP POLICY IF EXISTS "hr_balances_update" ON public.hr_leave_balances;
DROP POLICY IF EXISTS "hr_balances_delete" ON public.hr_leave_balances;

CREATE POLICY "hr_balances_select_own" ON public.hr_leave_balances FOR SELECT TO authenticated
USING (employee_id = (select auth.uid()));

CREATE POLICY "hr_balances_manage_admin_hr" ON public.hr_leave_balances FOR ALL TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = (select auth.uid()) AND role IN ('admin', 'super_admin', 'hr'))
)
WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = (select auth.uid()) AND role IN ('admin', 'super_admin', 'hr'))
);


-- leave_balances (legacy table checks)
DROP POLICY IF EXISTS "HR/Admin can manage leave balances" ON public.leave_balances;
DROP POLICY IF EXISTS "HR/Admin can view all leave balances" ON public.leave_balances;
DROP POLICY IF EXISTS "Users can view own leave balances" ON public.leave_balances;

CREATE POLICY "leave_balances_select_own" ON public.leave_balances FOR SELECT TO authenticated
USING (employee_id = (select auth.uid()));

CREATE POLICY "leave_balances_manage_admin_hr" ON public.leave_balances FOR ALL TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = (select auth.uid()) AND role IN ('admin', 'super_admin', 'hr'))
)
WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = (select auth.uid()) AND role IN ('admin', 'super_admin', 'hr'))
);


-- leave_requests
DROP POLICY IF EXISTS "Users can view own leave requests" ON public.leave_requests;
DROP POLICY IF EXISTS "Users can create leave requests" ON public.leave_requests;
DROP POLICY IF EXISTS "HR/Admin can view all leave requests" ON public.leave_requests;
DROP POLICY IF EXISTS "HR/Admin can update leave requests" ON public.leave_requests;

CREATE POLICY "leave_requests_view_own" ON public.leave_requests FOR SELECT TO authenticated
USING (employee_id = (select auth.uid()));

CREATE POLICY "leave_requests_create_own" ON public.leave_requests FOR INSERT TO authenticated
WITH CHECK (employee_id = (select auth.uid()));

CREATE POLICY "leave_requests_manage_admin_hr" ON public.leave_requests FOR ALL TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = (select auth.uid()) AND role IN ('admin', 'super_admin', 'hr'))
)
WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = (select auth.uid()) AND role IN ('admin', 'super_admin', 'hr'))
);


-- payment_ledger
DROP POLICY IF EXISTS "Admin can delete payments" ON public.payment_ledger;
DROP POLICY IF EXISTS "Accounts and Admin can view payments" ON public.payment_ledger;
DROP POLICY IF EXISTS "Accounts and Admin can create payments" ON public.payment_ledger;
DROP POLICY IF EXISTS "Accounts and Admin can update payments" ON public.payment_ledger;

CREATE POLICY "payment_ledger_select" ON public.payment_ledger FOR SELECT TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = (select auth.uid()) AND role IN ('admin', 'super_admin', 'accounts'))
);
CREATE POLICY "payment_ledger_modify" ON public.payment_ledger FOR ALL TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = (select auth.uid()) AND role IN ('admin', 'super_admin', 'accounts'))
)
WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = (select auth.uid()) AND role IN ('admin', 'super_admin', 'accounts'))
);


-- audit_log
DROP POLICY IF EXISTS "Admin can view audit logs" ON public.audit_log;
CREATE POLICY "Admin can view audit logs" ON public.audit_log FOR SELECT TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = (select auth.uid()) AND role IN ('admin', 'super_admin'))
);


-- ui_modules & ui_visibility_rules
DROP POLICY IF EXISTS "Allow write access for admins" ON public.ui_modules;
CREATE POLICY "ui_modules_manage" ON public.ui_modules FOR ALL TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = (select auth.uid()) AND role IN ('admin', 'super_admin'))
)
WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = (select auth.uid()) AND role IN ('admin', 'super_admin'))
);

DROP POLICY IF EXISTS "Allow write access for admins" ON public.ui_visibility_rules;
CREATE POLICY "ui_visibility_rules_manage" ON public.ui_visibility_rules FOR ALL TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = (select auth.uid()) AND role IN ('admin', 'super_admin'))
)
WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = (select auth.uid()) AND role IN ('admin', 'super_admin'))
);


-- user_roles
DROP POLICY IF EXISTS "Users can read own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Manage User Roles" ON public.user_roles;
-- Redundant
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;

CREATE POLICY "user_roles_select_own" ON public.user_roles FOR SELECT TO authenticated
USING (user_id = (select auth.uid()));

CREATE POLICY "user_roles_manage_admin" ON public.user_roles FOR ALL TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = (select auth.uid()) AND role IN ('admin', 'super_admin'))
)
WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = (select auth.uid()) AND role IN ('admin', 'super_admin'))
);


-- notifications
DROP POLICY IF EXISTS "Notifications: View/Update/Delete (Self)" ON public.notifications;
DROP POLICY IF EXISTS "notifications_delete" ON public.notifications;
DROP POLICY IF EXISTS "notifications_insert_optimized" ON public.notifications;
DROP POLICY IF EXISTS "notifications_select" ON public.notifications;
DROP POLICY IF EXISTS "notifications_select_optimized" ON public.notifications;
DROP POLICY IF EXISTS "notifications_update" ON public.notifications;
DROP POLICY IF EXISTS "notifications_update_optimized" ON public.notifications;

-- Recreate optimized notifications policy
CREATE POLICY "notifications_select_own" ON public.notifications FOR SELECT TO authenticated
USING (user_id = (select auth.uid()));

CREATE POLICY "notifications_insert_any" ON public.notifications FOR INSERT TO authenticated
WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE POLICY "notifications_update_own" ON public.notifications FOR UPDATE TO authenticated
USING (user_id = (select auth.uid()))
WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "notifications_delete_own" ON public.notifications FOR DELETE TO authenticated
USING (user_id = (select auth.uid()));
