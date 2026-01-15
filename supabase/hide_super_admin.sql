-- Migration: Add is_hidden column to profiles and hide Super Admin
-- This allows specific users (like the owner) to be hidden from lists while retaining access.

-- 1. Add is_hidden column if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'is_hidden') THEN
        ALTER TABLE public.profiles ADD COLUMN is_hidden BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- 2. Update specific user (hi@chhapai.in)
-- Set name to 'Rajesh ji', ensure 'admin' role, and set is_hidden = true
DO $$
DECLARE
    target_user_id UUID;
BEGIN
    -- Find user by email
    SELECT id INTO target_user_id FROM auth.users WHERE email = 'hi@chhapai.in';

    IF target_user_id IS NOT NULL THEN
        -- A. Update Profile Name and set Hidden
        UPDATE public.profiles
        SET full_name = 'Rajesh ji',
            is_hidden = true
        WHERE user_id = target_user_id;

        -- If profile doesn't exist (unlikely for existing user), insert it?
        -- Usually handled by triggers, but to be safe:
        IF NOT FOUND THEN
             INSERT INTO public.profiles (user_id, full_name, is_hidden)
             VALUES (target_user_id, 'Rajesh ji', true);
        END IF;

        -- B. Ensure 'admin' role in user_roles
        -- Delete existing roles to ensure clean slate (single role logic) or just upsert check
        -- User said "Admin or Super Admin". 'admin' is the role key.
        DELETE FROM public.user_roles WHERE user_id = target_user_id;
        INSERT INTO public.user_roles (user_id, role)
        VALUES (target_user_id, 'admin');
        
        -- C. Update hr_profiles if exists, mainly to ensure Department is Admin/HR?
        -- Optional, but good for consistency.
        INSERT INTO public.hr_profiles (user_id, department, designation)
        VALUES (target_user_id, 'Admin', 'Super Admin')
        ON CONFLICT (user_id) DO UPDATE
        SET department = 'Admin', designation = 'Super Admin';
        
    END IF;
END $$;
