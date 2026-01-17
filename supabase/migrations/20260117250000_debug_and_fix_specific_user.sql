-- Debug specific user ID: 8d335327-b062-4523-9d0d-ba88e87b70d2

-- Check if user exists in auth.users
SELECT 'auth.users' as source, id, email, raw_user_meta_data->>'full_name' as name
FROM auth.users 
WHERE id = '8d335327-b062-4523-9d0d-ba88e87b70d2';

-- Check if user exists in user_roles
SELECT 'user_roles' as source, user_id, role
FROM public.user_roles 
WHERE user_id = '8d335327-b062-4523-9d0d-ba88e87b70d2';

-- Check if user exists in profiles
SELECT 'profiles' as source, id, user_id, email, full_name
FROM public.profiles 
WHERE user_id = '8d335327-b062-4523-9d0d-ba88e87b70d2' OR id = '8d335327-b062-4523-9d0d-ba88e87b70d2';

-- If user exists in auth.users but not in profiles, create profile
INSERT INTO public.profiles (id, user_id, email, full_name, created_at, updated_at)
SELECT 
    u.id,
    u.id as user_id,
    u.email,
    COALESCE(
        u.raw_user_meta_data->>'full_name',
        u.raw_user_meta_data->>'name',
        split_part(u.email, '@', 1)
    ) as full_name,
    now(),
    now()
FROM auth.users u
WHERE u.id = '8d335327-b062-4523-9d0d-ba88e87b70d2'
ON CONFLICT (user_id) DO UPDATE 
SET 
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
    updated_at = now();

-- Final verification
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM public.profiles WHERE user_id = '8d335327-b062-4523-9d0d-ba88e87b70d2')
        THEN 'Profile EXISTS for user 8d335327-b062-4523-9d0d-ba88e87b70d2'
        ELSE 'Profile MISSING for user 8d335327-b062-4523-9d0d-ba88e87b70d2'
    END as status;
