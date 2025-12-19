-- Supabase User Setup SQL
-- User UID: 967ac67f-df74-4f96-93c9-052745267572

-- Step 1: Create Profile
INSERT INTO public.profiles (
  user_id,
  full_name,
  department,
  created_at,
  updated_at
) VALUES (
  '967ac67f-df74-4f96-93c9-052745267572',
  'Admin User',
  'sales', -- Change to 'admin' if needed
  NOW(),
  NOW()
)
ON CONFLICT (user_id) DO NOTHING; -- Avoid duplicate errors

-- Step 2: Create User Role (Admin)
INSERT INTO public.user_roles (
  user_id,
  role,
  created_at
) VALUES (
  '967ac67f-df74-4f96-93c9-052745267572',
  'admin', -- Change role if needed: 'admin', 'sales', 'design', 'prepress', 'production'
  NOW()
)
ON CONFLICT (user_id) DO NOTHING; -- Avoid duplicate errors

-- Verify the data was inserted
SELECT 
  u.id as auth_user_id,
  u.email,
  p.full_name,
  p.department,
  ur.role
FROM auth.users u
LEFT JOIN public.profiles p ON p.user_id = u.id
LEFT JOIN public.user_roles ur ON ur.user_id = u.id
WHERE u.id = '967ac67f-df74-4f96-93c9-052745267572';

