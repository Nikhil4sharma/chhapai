-- Verify assignment logic for Order #53660
-- Check BOTH order-level and item-level assignments

-- 1. Order-level assignment (Who owns the order?)
SELECT 
    o.order_number,
    o.assigned_user as order_owner_uuid,
    u.raw_user_meta_data->>'full_name' as order_owner_name
FROM public.orders o
LEFT JOIN auth.users u ON u.id = o.assigned_user
WHERE o.order_number = '53660';

-- 2. Item-level assignment (Who is assigned to each product?)
SELECT 
    oi.item_id,
    oi.product_name,
    oi.assigned_to as item_assignee_uuid,
    u.raw_user_meta_data->>'full_name' as item_assignee_name,
    oi.assigned_department,
    oi.current_stage,
    oi.status
FROM public.order_items oi
LEFT JOIN auth.users u ON u.id = oi.assigned_to
LEFT JOIN public.orders o ON o.id = oi.order_id
WHERE o.order_number = '53660';

-- 3. Test RLS for Mansi specifically
-- Get Mansi's UUID first
WITH mansi_user AS (
    SELECT id FROM auth.users 
    WHERE raw_user_meta_data->>'full_name' ILIKE '%mansi%' 
    LIMIT 1
)
SELECT 
    'Mansi can see order via RLS?' as check_type,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM public.orders o
            WHERE o.order_number = '53660'
            AND (
                -- Check all RLS conditions
                o.assigned_user = (SELECT id FROM mansi_user)
                OR EXISTS (
                    SELECT 1 FROM public.order_items oi
                    WHERE oi.order_id = o.id
                    AND oi.assigned_to = (SELECT id FROM mansi_user)
                )
            )
        ) THEN 'YES ✓'
        ELSE 'NO ✗'
    END as result;
