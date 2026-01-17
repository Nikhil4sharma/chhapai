-- Check which user is missing and create their profile
-- User ID: e10da70a-b8f0-4daa-8a22-46a34070106b

-- First, check if this user exists in auth.users
SELECT id, email, raw_user_meta_data FROM auth.users 
WHERE id = 'e10da70a-b8f0-4daa-8a22-46a34070106b';

-- Create profile for this specific user
INSERT INTO public.profiles (id, user_id, email, full_name, created_at, updated_at)
SELECT 
    u.id,
    u.id as user_id,
    u.email,
    COALESCE(
        u.raw_user_meta_data->>'full_name',
        u.raw_user_meta_data->>'name',
        'Rohini'  -- Default name based on earlier mapping
    ) as full_name,
    COALESCE(u.created_at, now()),
    now()
FROM auth.users u
WHERE u.id = 'e10da70a-b8f0-4daa-8a22-46a34070106b'
ON CONFLICT (user_id) DO UPDATE 
SET 
    email = EXCLUDED.email,
    full_name = COALESCE(profiles.full_name, EXCLUDED.full_name),
    updated_at = now();
