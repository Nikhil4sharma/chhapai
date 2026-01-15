-- Fix profiles RLS to allow admin to insert new team members
-- Run this in Supabase SQL Editor

-- Drop existing INSERT policy
DROP POLICY IF EXISTS "Allow admin to insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.profiles;

-- Create new INSERT policy for admins
CREATE POLICY "Allow admin to insert profiles"
    ON public.profiles
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_roles.user_id = auth.uid()
            AND user_roles.role = 'admin'
        )
    );

-- Also allow users to insert their own profile (for signup)
CREATE POLICY "Allow users to insert own profile"
    ON public.profiles
    FOR INSERT
    WITH CHECK (user_id = auth.uid());
