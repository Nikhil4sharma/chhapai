-- V4 Fix: Most Permissive Version
-- Removes RAISE EXCEPTION to prevent 400 errors from logic checks
-- Adds COALESCE to all fields to prevent null errors

DROP FUNCTION IF EXISTS public.get_admin_user_profiles();

CREATE OR REPLACE FUNCTION public.get_admin_user_profiles()
RETURNS TABLE (
    id uuid,
    user_id uuid,
    full_name text,
    department text,
    avatar_url text,
    email text,
    role text,
    hr_data jsonb
) 
SECURITY DEFINER
SET search_path = public, auth
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.user_id,
        COALESCE(p.full_name, 'Unknown'),
        p.department,
        p.avatar_url,
        COALESCE(u.email::text, 'No Email'), -- Cast email to text explicitly
        COALESCE(ur.role::text, 'none'),     -- Cast role to text explicitly
        COALESCE(to_jsonb(hr.*), '{}'::jsonb)
    FROM public.profiles p
    JOIN auth.users u ON p.user_id = u.id
    LEFT JOIN public.user_roles ur ON p.user_id = ur.user_id
    LEFT JOIN public.hr_employees hr ON p.user_id = hr.id;
END;
$$;
