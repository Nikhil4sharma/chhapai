-- FIX ENUM AND HIDDEN USER (v6 - No ON CONFLICT)

-- 1. Update app_role Enum (Idempotent)
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

-- 2. Verify and Hide Super Admin (hi@chhapai.in)
DO $$
DECLARE
    target_user_id UUID;
BEGIN
    SELECT id INTO target_user_id FROM auth.users WHERE email = 'hi@chhapai.in';

    IF target_user_id IS NOT NULL THEN
        -- A. Handle Profile
        -- Attempt update first
        UPDATE public.profiles 
        SET is_hidden = true, full_name = 'Rajesh ji' 
        WHERE user_id = target_user_id;

        -- If no row updated, insert (Manual Upsert)
        IF NOT FOUND THEN
             INSERT INTO public.profiles (user_id, full_name, is_hidden)
             VALUES (target_user_id, 'Rajesh ji', true);
        END IF;
        
        -- B. Handle Role (DELETE + INSERT to avoid constraint issues)
        DELETE FROM public.user_roles WHERE user_id = target_user_id;
        
        INSERT INTO public.user_roles (user_id, role)
        VALUES (target_user_id, 'admin');

    END IF;
END $$;
