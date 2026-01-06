-- Security Fixes: Set search_path for functions
-- Fixes db lints: function_search_path_mutable

-- 1. update_woocommerce_credentials_updated_at
-- Assuming this is a trigger function (returns TRIGGER, no args)
ALTER FUNCTION public.update_woocommerce_credentials_updated_at() SET search_path = public;

-- 2. update_updated_at_column
ALTER FUNCTION public.update_updated_at_column() SET search_path = public;

-- 3. process_inventory_transaction
ALTER FUNCTION public.process_inventory_transaction() SET search_path = public;

-- 4. is_admin (both variants)
-- Variant 1: No args (checks current user)
ALTER FUNCTION public.is_admin() SET search_path = public;


-- 5. get_my_department
ALTER FUNCTION public.get_my_department() SET search_path = public;
