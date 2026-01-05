-- Final V3 Fix for Admin User Profiles
-- Fixes 400 Bad Request by ensuring all types are strictly compatible

-- 1. Drop existing function signature to allow return type changes
DROP FUNCTION IF EXISTS public.get_admin_user_profiles();

-- 2. Re-create with robust type handling
CREATE OR REPLACE FUNCTION public.get_admin_user_profiles()
RETURNS TABLE (
    id uuid,
    user_id uuid,
    full_name text,
    department text,
    avatar_url text,
    email text,
    role text,      -- Changed Enum to Text
    hr_data jsonb   -- HR details as JSON blob
) 
SECURITY DEFINER
SET search_path = public, auth
LANGUAGE plpgsql
AS $$
BEGIN
    -- 1. Security Check: Ensure user is an Admin
    IF NOT EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() 
        AND role::text = 'admin'  -- Cast to text for safe comparison
    ) THEN
        RAISE EXCEPTION 'Access denied: User is not an admin';
    END IF;

    -- 2. Return Query with Safe Casting
    RETURN QUERY
    SELECT 
        p.id,
        p.user_id,
        COALESCE(p.full_name, 'Unknown User'),
        p.department,
        p.avatar_url,
        u.email::text,          -- Explicitly cast email from auth schema
        ur.role::text,          -- Explicitly cast Enum to text
        COALESCE(to_jsonb(hr.*), '{}'::jsonb) -- Handle null HR data safely
    FROM public.profiles p
    JOIN auth.users u ON p.user_id = u.id
    LEFT JOIN public.user_roles ur ON p.user_id = ur.user_id
    LEFT JOIN public.hr_employees hr ON p.user_id = hr.id;
END;
$$;
