-- Migration: Add email column to profiles table
-- Created: 2026-01-15
-- Purpose: Store email in profiles for easier querying

-- Add email column to profiles if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'profiles' 
        AND column_name = 'email'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN email text;
        CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
    END IF;
END $$;

-- Create function to sync email from auth.users to profiles
CREATE OR REPLACE FUNCTION public.sync_profile_email()
RETURNS TRIGGER AS $$
BEGIN
    -- Update profile email when user email changes
    UPDATE public.profiles
    SET email = NEW.email
    WHERE id = NEW.id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on auth.users to sync email
DROP TRIGGER IF EXISTS sync_email_to_profile ON auth.users;
CREATE TRIGGER sync_email_to_profile
    AFTER INSERT OR UPDATE OF email ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_profile_email();

-- Backfill existing emails from auth.users to profiles
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id
AND p.email IS NULL;
