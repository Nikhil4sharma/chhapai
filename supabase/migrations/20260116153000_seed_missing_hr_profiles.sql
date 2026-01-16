-- Seed HR Profiles for all existing users who don't have one
-- This ensures every user can access the HR portal

-- STEP 1: Seed missing public.profiles first to satisfy FK constraint
-- profiles.id is the PK that hr_profiles.user_id references
INSERT INTO public.profiles (id, user_id, full_name)
SELECT 
    au.id as id,  -- This becomes profiles.id (PK)
    au.id as user_id,  -- This is profiles.user_id (FK to auth.users)
    COALESCE(au.raw_user_meta_data->>'full_name', 'User ' || substr(au.id::text, 1, 6))
FROM auth.users au
WHERE au.id NOT IN (SELECT id FROM public.profiles)  -- Check against profiles.id (PK)
ON CONFLICT (user_id) DO NOTHING;

-- STEP 2: Now Seed HR Profiles (dependent on profiles.id)
-- hr_profiles.user_id references profiles.id (not profiles.user_id!)
INSERT INTO public.hr_profiles (user_id, department, employment_status, joining_date)
SELECT 
    p.id,  -- Use profiles.id (PK) which is what the FK references
    'Unassigned' as department,
    'active' as employment_status,
    CURRENT_DATE as joining_date
FROM public.profiles p
WHERE p.id NOT IN (SELECT user_id FROM public.hr_profiles)
ON CONFLICT (user_id) DO NOTHING;
