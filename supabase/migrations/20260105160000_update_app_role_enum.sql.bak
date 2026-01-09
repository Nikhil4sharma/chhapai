-- Fix app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'dispatch';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'hr_admin';

-- Assign Super Admin role to Rajesh
DO $$
DECLARE
    rajesh_id uuid;
BEGIN
    -- Try to find Rajesh by email or name (case insensitive)
    SELECT id INTO rajesh_id
    FROM auth.users
    WHERE email ILIKE '%rajesh%'
       OR raw_user_meta_data->>'full_name' ILIKE '%rajesh%'
    LIMIT 1;

    IF rajesh_id IS NOT NULL THEN
        -- Delete existing role if any
        DELETE FROM public.user_roles WHERE user_id = rajesh_id;
        
        -- Insert super_admin role
        INSERT INTO public.user_roles (user_id, role)
        VALUES (rajesh_id, 'super_admin');
        
        RAISE NOTICE 'Assigned super_admin role to user ID: %', rajesh_id;
    ELSE
        RAISE NOTICE 'User Rajesh not found. Please manually assign super_admin role.';
    END IF;
END $$;
