-- Create trigger to auto-sync auth.users updates to profiles table
-- This ensures profile changes are always reflected in the profiles table

-- Function to sync auth.users to profiles
CREATE OR REPLACE FUNCTION public.sync_auth_user_to_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Update or insert profile when auth.users is updated
    INSERT INTO public.profiles (
        id,
        user_id,
        email,
        full_name,
        avatar_url,
        created_at,
        updated_at
    )
    VALUES (
        NEW.id,
        NEW.id,
        NEW.email,
        COALESCE(
            NEW.raw_user_meta_data->>'full_name',
            NEW.raw_user_meta_data->>'name',
            split_part(NEW.email, '@', 1)
        ),
        NEW.raw_user_meta_data->>'avatar_url',
        COALESCE(NEW.created_at, now()),
        now()
    )
    ON CONFLICT (user_id) DO UPDATE
    SET
        email = EXCLUDED.email,
        full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
        avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url),
        updated_at = now();
    
    RETURN NEW;
END;
$$;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;

-- Create trigger on auth.users
CREATE TRIGGER on_auth_user_updated
    AFTER INSERT OR UPDATE ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_auth_user_to_profile();

-- Manually sync all existing users to ensure consistency
INSERT INTO public.profiles (id, user_id, email, full_name, avatar_url, created_at, updated_at)
SELECT 
    u.id,
    u.id as user_id,
    u.email,
    COALESCE(
        u.raw_user_meta_data->>'full_name',
        u.raw_user_meta_data->>'name',
        split_part(u.email, '@', 1)
    ) as full_name,
    u.raw_user_meta_data->>'avatar_url' as avatar_url,
    COALESCE(u.created_at, now()),
    now()
FROM auth.users u
ON CONFLICT (user_id) DO UPDATE 
SET 
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url),
    updated_at = now();
