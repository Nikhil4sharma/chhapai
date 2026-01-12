-- ============================================
-- MANUAL CLEANUP SCRIPT
-- Run this in Supabase SQL Editor
-- ============================================

-- This will delete orphaned woocommerce_imports records
-- where the actual order has been deleted from orders table

DELETE FROM public.woocommerce_imports
WHERE NOT EXISTS (
    SELECT 1 FROM public.orders
    WHERE orders.woo_order_id::text = woocommerce_imports.woocommerce_order_id::text
);

-- Check how many records were cleaned
SELECT 
    COUNT(*) as total_import_records,
    COUNT(CASE WHEN EXISTS (
        SELECT 1 FROM public.orders 
        WHERE orders.woo_order_id::text = woocommerce_imports.woocommerce_order_id::text
    ) THEN 1 END) as valid_records
FROM public.woocommerce_imports;
