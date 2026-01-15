-- FIX ENUM AND HIDDEN USER (v5)

-- 1. Update app_role Enum
-- Postgres doesn't allow "IF NOT EXISTS" for enum values easily, so we catch errors
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
        -- Ensure profile exists and is hidden
        INSERT INTO public.profiles (user_id, full_name, is_hidden)
        VALUES (target_user_id, 'Rajesh ji', true)
        ON CONFLICT (user_id) 
        DO UPDATE SET is_hidden = true, full_name = 'Rajesh ji';
        
        -- Also check user_roles
        -- Ensure he has 'admin' role (or 'super_admin' if your app distinguishes)
        -- Removing 'accounts' or other roles if they accidentally got added
        DELETE FROM public.user_roles WHERE user_id = target_user_id AND role != 'admin';
        
        INSERT INTO public.user_roles (user_id, role)
        VALUES (target_user_id, 'admin')
        ON CONFLICT (user_id, role) DO NOTHING;
    END IF;
END $$;

-- 3. Fix "operator does not exist: app_role = text" issues in Policies?
-- Usually adding the enum value is enough. 
-- However, if there are policies comparing role = 'some_text', they should work now.

-- 4. Double check RLS on profiles to ensure "is_hidden" column is readable
-- (Assuming standard Select policy is open)
