-- Sync ALL users from user_roles to profiles
-- This ensures every user in user_roles has a corresponding profile

-- First, create profiles for users in user_roles who don't have profiles yet
INSERT INTO public.profiles (id, user_id, email, full_name, created_at, updated_at)
SELECT 
    ur.user_id as id,
    ur.user_id,
    u.email,
    COALESCE(
        u.raw_user_meta_data->>'full_name',
        u.raw_user_meta_data->>'name',
        split_part(u.email, '@', 1)
    ) as full_name,
    now(),
    now()
FROM public.user_roles ur
INNER JOIN auth.users u ON ur.user_id = u.id
WHERE NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.user_id = ur.user_id
)
ON CONFLICT (user_id) DO NOTHING;

-- Report status
DO $$
DECLARE
    user_roles_count INTEGER;
    profiles_count INTEGER;
    missing_count INTEGER;
BEGIN
    SELECT COUNT(DISTINCT user_id) INTO user_roles_count FROM public.user_roles;
    SELECT COUNT(*) INTO profiles_count FROM public.profiles;
    
    SELECT COUNT(*) INTO missing_count
    FROM public.user_roles ur
    LEFT JOIN public.profiles p ON ur.user_id = p.user_id
    WHERE p.user_id IS NULL;
    
    RAISE NOTICE 'Total users in user_roles: %', user_roles_count;
    RAISE NOTICE 'Total profiles: %', profiles_count;
    
    IF missing_count > 0 THEN
        RAISE WARNING 'Still % users in user_roles without profiles!', missing_count;
    ELSE
        RAISE NOTICE 'All user_roles users have profiles!';
    END IF;
END $$;
