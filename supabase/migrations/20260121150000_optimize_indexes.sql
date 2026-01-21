-- Optimize Database Indexes
-- Fixes: unindexed_foreign_keys, unused_index

-- ==============================================================================
-- 1. Create missing indexes for Foreign Keys (Performance)
-- ==============================================================================

-- audit_log
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON public.audit_log(user_id);

-- hr_employees
CREATE INDEX IF NOT EXISTS idx_hr_employees_reporting_manager_id ON public.hr_employees(reporting_manager_id);

-- hr_leave_balances
CREATE INDEX IF NOT EXISTS idx_hr_leave_balances_leave_type_id ON public.hr_leave_balances(leave_type_id);

-- hr_leaves
CREATE INDEX IF NOT EXISTS idx_hr_leaves_approved_by ON public.hr_leaves(approved_by);
CREATE INDEX IF NOT EXISTS idx_hr_leaves_leave_type_id ON public.hr_leaves(leave_type_id);
CREATE INDEX IF NOT EXISTS idx_hr_leaves_user_id ON public.hr_leaves(user_id);

-- hr_profiles
CREATE INDEX IF NOT EXISTS idx_hr_profiles_reporting_manager_id ON public.hr_profiles(reporting_manager_id);

-- inventory_transactions
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_performed_by ON public.inventory_transactions(performed_by);

-- job_materials
CREATE INDEX IF NOT EXISTS idx_job_materials_paper_id ON public.job_materials(paper_id);

-- leave_balances
CREATE INDEX IF NOT EXISTS idx_leave_balances_leave_type_id ON public.leave_balances(leave_type_id);

-- leave_requests
CREATE INDEX IF NOT EXISTS idx_leave_requests_approved_by ON public.leave_requests(approved_by);
CREATE INDEX IF NOT EXISTS idx_leave_requests_leave_type_id ON public.leave_requests(leave_type_id);

-- notifications
CREATE INDEX IF NOT EXISTS idx_notifications_customer_id ON public.notifications(customer_id);
CREATE INDEX IF NOT EXISTS idx_notifications_order_id ON public.notifications(order_id);

-- order_activity
CREATE INDEX IF NOT EXISTS idx_order_activity_item_id ON public.order_activity(item_id);
CREATE INDEX IF NOT EXISTS idx_order_activity_performed_by ON public.order_activity(performed_by);

-- order_activity_logs
CREATE INDEX IF NOT EXISTS idx_order_activity_logs_created_by ON public.order_activity_logs(created_by);

-- order_files
CREATE INDEX IF NOT EXISTS idx_order_files_item_id ON public.order_files(item_id);
CREATE INDEX IF NOT EXISTS idx_order_files_order_id ON public.order_files(order_id);
CREATE INDEX IF NOT EXISTS idx_order_files_uploaded_by ON public.order_files(uploaded_by);

-- order_items
CREATE INDEX IF NOT EXISTS idx_order_items_previous_assigned_to ON public.order_items(previous_assigned_to);
CREATE INDEX IF NOT EXISTS idx_order_items_substage_user ON public.order_items(substage_user);

-- order_messages
CREATE INDEX IF NOT EXISTS idx_order_messages_sender_id ON public.order_messages(sender_id);

-- orders
CREATE INDEX IF NOT EXISTS idx_orders_created_by ON public.orders(created_by);

-- payment_ledger
CREATE INDEX IF NOT EXISTS idx_payment_ledger_created_by ON public.payment_ledger(created_by);

-- proforma_invoices
CREATE INDEX IF NOT EXISTS idx_proforma_invoices_created_by ON public.proforma_invoices(created_by);

-- timeline
CREATE INDEX IF NOT EXISTS idx_timeline_item_id ON public.timeline(item_id);
CREATE INDEX IF NOT EXISTS idx_timeline_performed_by ON public.timeline(performed_by);

-- ui_visibility_rules
CREATE INDEX IF NOT EXISTS idx_ui_visibility_rules_module_key ON public.ui_visibility_rules(module_key);

-- user_work_logs
CREATE INDEX IF NOT EXISTS idx_user_work_logs_order_id ON public.user_work_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_user_work_logs_order_item_id ON public.user_work_logs(order_item_id);

-- wc_customers
CREATE INDEX IF NOT EXISTS idx_wc_customers_assigned_manager ON public.wc_customers(assigned_manager);

-- work_notes
CREATE INDEX IF NOT EXISTS idx_work_notes_order_id ON public.work_notes(order_id);
CREATE INDEX IF NOT EXISTS idx_work_notes_order_item_id ON public.work_notes(order_item_id);
CREATE INDEX IF NOT EXISTS idx_work_notes_user_id ON public.work_notes(user_id);


-- ==============================================================================
-- 2. Remove unused indexes (Performance - Write Overhead Maintenance)
-- ==============================================================================

-- leave_balances
DROP INDEX IF EXISTS public.idx_leave_balances_year;

-- leave_requests
DROP INDEX IF EXISTS public.idx_leave_requests_status;
DROP INDEX IF EXISTS public.idx_leave_requests_dates;

-- orders
DROP INDEX IF EXISTS public.idx_orders_current_department;
DROP INDEX IF EXISTS public.idx_orders_is_urgent;
DROP INDEX IF EXISTS public.idx_orders_migration_date;
DROP INDEX IF EXISTS public.idx_orders_imported_by;
DROP INDEX IF EXISTS public.idx_orders_is_completed;

-- hr_profiles
DROP INDEX IF EXISTS public.idx_hr_profiles_department;
DROP INDEX IF EXISTS public.idx_hr_profiles_status;

-- order_activity_logs
DROP INDEX IF EXISTS public.idx_order_activity_logs_order_id;
DROP INDEX IF EXISTS public.idx_order_activity_logs_department;

-- profiles
DROP INDEX IF EXISTS public.idx_profiles_email;

-- delay_reasons
DROP INDEX IF EXISTS public.idx_delay_reasons_order_id;
DROP INDEX IF EXISTS public.idx_delay_reasons_item_id;
DROP INDEX IF EXISTS public.idx_delay_reasons_reported_at;
DROP INDEX IF EXISTS public.idx_delay_reasons_order_item;
DROP INDEX IF EXISTS public.idx_delay_reasons_category;
DROP INDEX IF EXISTS public.idx_delay_reasons_stage;

-- notifications
DROP INDEX IF EXISTS public.idx_notifications_read;
DROP INDEX IF EXISTS public.idx_notifications_is_read;

-- woocommerce_imports
DROP INDEX IF EXISTS public.idx_woocommerce_imports_order_number;
DROP INDEX IF EXISTS public.idx_woocommerce_imports_imported_at;

-- order_items
DROP INDEX IF EXISTS public.idx_order_items_assigned_department;
DROP INDEX IF EXISTS public.idx_order_items_substage_status;

-- payment_ledger
DROP INDEX IF EXISTS public.idx_payment_ledger_customer_id;
DROP INDEX IF EXISTS public.idx_payment_ledger_order_id;
DROP INDEX IF EXISTS public.idx_payment_ledger_created_at;

-- user_work_logs
DROP INDEX IF EXISTS public.idx_user_work_logs_work_date;

-- employees
DROP INDEX IF EXISTS public.idx_employees_category;
DROP INDEX IF EXISTS public.idx_employees_email;

-- wc_customers
DROP INDEX IF EXISTS public.idx_wc_customers_search;

-- paper_inventory
DROP INDEX IF EXISTS public.idx_paper_status;

-- inventory_transactions
DROP INDEX IF EXISTS public.idx_transactions_paper;

-- order_messages
DROP INDEX IF EXISTS public.idx_order_messages_created_at;
