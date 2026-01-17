-- Debug Profile IDs and FKs

-- 1. Check if id = user_id for profiles
SELECT 
    count(*) as total_profiles,
    count(*) filter (where id = user_id) as matching_ids,
    count(*) filter (where id != user_id) as mismatching_ids
FROM public.profiles;

-- 2. Check a sample mismatch if any
SELECT id, user_id, full_name, email 
FROM public.profiles 
WHERE id != user_id 
LIMIT 5;

-- 3. Check specific problematic Users
SELECT id, user_id, full_name, email 
FROM public.profiles 
WHERE user_id IN (
    '8d335327-b062-4523-9d0d-ba88e87b70d2',
    'e10da70a-b8f0-4daa-8a22-46a34070106b',
    '61079186-d034-435f-b5ce-23c862b68955'
);

-- 4. Check user_roles for these users
SELECT user_id, role 
FROM public.user_roles 
WHERE user_id IN (
    '8d335327-b062-4523-9d0d-ba88e87b70d2',
    'e10da70a-b8f0-4daa-8a22-46a34070106b',
    '61079186-d034-435f-b5ce-23c862b68955'
);
