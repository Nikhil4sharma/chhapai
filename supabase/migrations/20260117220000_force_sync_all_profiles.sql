-- Force sync ALL auth.users to profiles (including missing ones)
-- This ensures no user is left without a profile

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

-- Verify sync worked
DO $$
DECLARE
    missing_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO missing_count
    FROM auth.users u
    LEFT JOIN public.profiles p ON u.id = p.user_id
    WHERE p.user_id IS NULL;
    
    IF missing_count > 0 THEN
        RAISE WARNING 'Still % users without profiles!', missing_count;
    ELSE
        RAISE NOTICE 'All % users synced successfully!', (SELECT COUNT(*) FROM auth.users);
    END IF;
END $$;
