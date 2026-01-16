-- Drop old FK constraint that references auth.users
-- This is blocking the new constraint that should reference profiles.id

ALTER TABLE public.hr_profiles 
DROP CONSTRAINT IF EXISTS hr_profiles_user_id_fkey;

-- The new constraint will be added by migration 20260116150000_link_hr_profiles_to_profiles.sql
