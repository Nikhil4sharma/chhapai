-- Debug Order #53660 to find why Mansi can't see it

-- 1. Get Mansi's UUID
SELECT id, email, raw_user_meta_data->>'full_name' as name
FROM auth.users 
WHERE raw_user_meta_data->>'full_name' ILIKE '%mansi%';

-- 2. Get Mansi's roles
SELECT ur.user_id, ur.role, u.raw_user_meta_data->>'full_name' as name
FROM public.user_roles ur
JOIN auth.users u ON u.id = ur.user_id
WHERE u.raw_user_meta_data->>'full_name' ILIKE '%mansi%';

-- 3. Get Order Items for #53660
SELECT 
    oi.item_id,
    oi.product_name,
    oi.assigned_to,
    oi.assigned_department,
    oi.current_stage,
    oi.department,
    oi.status,
    o.order_number
FROM public.order_items oi
JOIN public.orders o ON o.id = oi.order_id
WHERE o.order_number = '53660';

-- 4. Check if assigned_to matches Mansi's UUID
SELECT 
    oi.item_id,
    oi.assigned_to,
    oi.assigned_to::text as assigned_to_text,
    (SELECT id FROM auth.users WHERE raw_user_meta_data->>'full_name' ILIKE '%mansi%' LIMIT 1) as mansi_uuid,
    CASE 
        WHEN oi.assigned_to = (SELECT id FROM auth.users WHERE raw_user_meta_data->>'full_name' ILIKE '%mansi%' LIMIT 1) 
        THEN 'MATCH ✓' 
        ELSE 'NO MATCH ✗' 
    END as uuid_match
FROM public.order_items oi
JOIN public.orders o ON o.id = oi.order_id
WHERE o.order_number = '53660';
