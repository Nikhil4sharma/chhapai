-- Sync ALL users from auth.users to profiles
-- This ensures every user in the system has a profile entry

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
    COALESCE(u.created_at, now()),
    now()
FROM auth.users u
WHERE NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.user_id = u.id
)
ON CONFLICT (user_id) DO UPDATE 
SET 
    email = EXCLUDED.email,
    full_name = COALESCE(profiles.full_name, EXCLUDED.full_name),
    updated_at = now();
