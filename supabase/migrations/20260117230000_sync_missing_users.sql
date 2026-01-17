-- Sync specific missing users that are causing FK violations
-- User IDs: 8d335327-b062-4523-9d0d-ba88e87b70d2, 967ac67f-df74-4f96-93c9-052745267572, e10da70a-b8f0-4daa-8a22-46a34070106b

INSERT INTO public.profiles (id, user_id, email, full_name, avatar_url, created_at, updated_at)
SELECT 
    u.id,
    u.id as user_id,
    u.email,
    COALESCE(
        u.raw_user_meta_data->>'full_name',
        u.raw_user_meta_data->>'name',
        split_part(u.email, '@', 1)
    ) as full_name,
    u.raw_user_meta_data->>'avatar_url' as avatar_url,
    COALESCE(u.created_at, now()),
    now()
FROM auth.users u
WHERE u.id IN (
    '8d335327-b062-4523-9d0d-ba88e87b70d2',
    '967ac67f-df74-4f96-93c9-052745267572',
    'e10da70a-b8f0-4daa-8a22-46a34070106b'
)
ON CONFLICT (user_id) DO UPDATE 
SET 
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url),
    updated_at = now();

-- Also run a full sync again to catch any other missing users
INSERT INTO public.profiles (id, user_id, email, full_name, avatar_url, created_at, updated_at)
SELECT 
    u.id,
    u.id as user_id,
    u.email,
    COALESCE(
        u.raw_user_meta_data->>'full_name',
        u.raw_user_meta_data->>'name',
        split_part(u.email, '@', 1)
    ) as full_name,
    u.raw_user_meta_data->>'avatar_url' as avatar_url,
    COALESCE(u.created_at, now()),
    now()
FROM auth.users u
ON CONFLICT (user_id) DO UPDATE 
SET 
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url),
    updated_at = now();

-- Report sync status
DO $$
DECLARE
    total_users INTEGER;
    total_profiles INTEGER;
    missing_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_users FROM auth.users;
    SELECT COUNT(*) INTO total_profiles FROM public.profiles;
    
    SELECT COUNT(*) INTO missing_count
    FROM auth.users u
    LEFT JOIN public.profiles p ON u.id = p.user_id
    WHERE p.user_id IS NULL;
    
    RAISE NOTICE 'Total users in auth.users: %', total_users;
    RAISE NOTICE 'Total profiles synced: %', total_profiles;
    
    IF missing_count > 0 THEN
        RAISE WARNING 'Still % users without profiles!', missing_count;
    ELSE
        RAISE NOTICE 'All users synced successfully!';
    END IF;
END $$;
