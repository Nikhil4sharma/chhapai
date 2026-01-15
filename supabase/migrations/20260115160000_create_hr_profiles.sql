-- Migration: Create HR Profiles Table with RLS
-- Created: 2026-01-15
-- Purpose: Enable HR/Admin to manage employee profiles with realtime updates

-- Create hr_profiles table if not exists
CREATE TABLE IF NOT EXISTS public.hr_profiles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
    joining_date date,
    department text,
    designation text,
    base_salary numeric(12, 2),
    employment_status text DEFAULT 'active' CHECK (employment_status IN ('active', 'probation', 'terminated', 'resigned')),
    reporting_manager_id uuid REFERENCES auth.users(id),
    bank_details jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_hr_profiles_user_id ON public.hr_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_hr_profiles_department ON public.hr_profiles(department);
CREATE INDEX IF NOT EXISTS idx_hr_profiles_status ON public.hr_profiles(employment_status);

-- Enable Row Level Security
ALTER TABLE public.hr_profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "HR/Admin can view all profiles" ON public.hr_profiles;
DROP POLICY IF EXISTS "HR/Admin can update all profiles" ON public.hr_profiles;
DROP POLICY IF EXISTS "HR/Admin can insert profiles" ON public.hr_profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.hr_profiles;

-- Policy: HR/Admin can view all profiles
CREATE POLICY "HR/Admin can view all profiles"
    ON public.hr_profiles
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.department IN ('HR', 'Admin')
        )
    );

-- Policy: HR/Admin can update all profiles
CREATE POLICY "HR/Admin can update all profiles"
    ON public.hr_profiles
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.department IN ('HR', 'Admin')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.department IN ('HR', 'Admin')
        )
    );

-- Policy: HR/Admin can insert profiles
CREATE POLICY "HR/Admin can insert profiles"
    ON public.hr_profiles
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.department IN ('HR', 'Admin')
        )
    );

-- Policy: Users can view their own profile
CREATE POLICY "Users can view own profile"
    ON public.hr_profiles
    FOR SELECT
    USING (user_id = auth.uid());

-- Create updated_at trigger function if not exists
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_hr_profiles_updated_at ON public.hr_profiles;
CREATE TRIGGER update_hr_profiles_updated_at
    BEFORE UPDATE ON public.hr_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for hr_profiles
ALTER PUBLICATION supabase_realtime ADD TABLE public.hr_profiles;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON public.hr_profiles TO authenticated;
