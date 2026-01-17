-- Sync profiles from auth.users for sales agents
-- This ensures all mapped agents have valid profiles

INSERT INTO public.profiles (id, user_id, email, full_name, created_at, updated_at)
SELECT 
    u.id,
    u.id as user_id,
    u.email,
    CASE 
        WHEN u.email = 'rohini@chhapai.in' THEN 'Rohini'
        WHEN u.email = 'work@chhapai.in' THEN 'Jaskaran'
        WHEN u.email = 'chd+1@chhapai.in' THEN 'Nikhil Sharma'
        ELSE COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1))
    END as full_name,
    now(),
    now()
FROM auth.users u
WHERE u.email IN ('rohini@chhapai.in', 'work@chhapai.in', 'chd+1@chhapai.in')
ON CONFLICT (user_id) DO UPDATE 
SET 
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    updated_at = now();
