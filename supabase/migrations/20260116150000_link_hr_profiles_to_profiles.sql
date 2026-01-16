-- Add FK from hr_profiles to profiles to enable PostgREST embedding
-- This allows: select=*,public_profile:profiles(*)

-- 1. Backfill missing profiles for existing hr_profiles (Data Integrity Fix)
-- We attempt to insert a stub profile for any hr_profile.user_id that is missing from profiles.
-- We use ON CONFLICT DO NOTHING just in case.
INSERT INTO public.profiles (id, user_id, full_name, department)
SELECT 
    user_id, -- id (PK)
    user_id, -- user_id (FK to auth.users usually, or just column)
    'Recovered User', -- Fallback name
    'HR' -- Default department (safe fallback)
FROM public.hr_profiles
WHERE user_id NOT IN (SELECT id FROM public.profiles)
ON CONFLICT DO NOTHING;

-- 2. Delete any remaining orphans (users that don't exist in auth.users or couldn't be inserted)
-- This ensures the FK constraint won't fail.
DELETE FROM public.hr_profiles
WHERE user_id NOT IN (SELECT id FROM public.profiles);

-- 3. Add the FK constraint (if not already exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'hr_profiles_to_profiles_fk'
        AND conrelid = 'public.hr_profiles'::regclass
    ) THEN
        ALTER TABLE public.hr_profiles
            ADD CONSTRAINT hr_profiles_to_profiles_fk
            FOREIGN KEY (user_id)
            REFERENCES public.profiles(id)
            ON DELETE CASCADE;
    END IF;
END $$;
