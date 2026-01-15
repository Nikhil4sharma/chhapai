-- FIX ENUM CASTING ERROR (v8)

-- The error "operator does not exist: app_role = text" happens because
-- public.has_role() compares the 'role' enum column directly with a text parameter.
-- We must cast the enum column to text for the comparison to work.

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
    AND role::text = _role -- FIX: Cast ENUM to TEXT
  );
END;
$$;

-- Also ensure 'accounts' and 'outsource' are in the enum (idempotent)
DO $$
BEGIN
    ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'accounts';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$
BEGIN
    ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'outsource';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Verify hr_profiles constraint for the 404/Conflict issue
-- Ensure user_id is unique so upserts work
ALTER TABLE public.hr_profiles
DROP CONSTRAINT IF EXISTS hr_profiles_user_id_key;

ALTER TABLE public.hr_profiles
ADD CONSTRAINT hr_profiles_user_id_key UNIQUE (user_id);
