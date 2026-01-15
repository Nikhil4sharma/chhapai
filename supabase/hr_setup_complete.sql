-- ============================================
-- HR Employee Management - Complete Setup SQL
-- Run this entire script in Supabase SQL Editor
-- ============================================

-- STEP 1: Add email column to profiles
-- ============================================
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'profiles' 
        AND column_name = 'email'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN email text;
        CREATE INDEX idx_profiles_email ON public.profiles(email);
    END IF;
END $$;

-- Backfill existing emails from auth.users
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id
AND p.email IS NULL;


-- STEP 2: Create employees table
-- ============================================
CREATE TABLE IF NOT EXISTS public.employees (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    employee_code text UNIQUE,
    first_name text NOT NULL,
    last_name text,
    email text NOT NULL,
    phone text,
    category text DEFAULT 'office' CHECK (category IN ('office', 'factory')),
    is_tool_user boolean DEFAULT false,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_employees_user_id ON public.employees(user_id);
CREATE INDEX IF NOT EXISTS idx_employees_category ON public.employees(category);
CREATE INDEX IF NOT EXISTS idx_employees_email ON public.employees(email);


-- STEP 3: Enable RLS and create policies
-- ============================================
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (prevents "already exists" errors)
DROP POLICY IF EXISTS "HR/Admin can view all employees" ON public.employees;
DROP POLICY IF EXISTS "HR/Admin can manage employees" ON public.employees;
DROP POLICY IF EXISTS "Users can view own employee record" ON public.employees;

-- Create RLS Policies
CREATE POLICY "HR/Admin can view all employees"
    ON public.employees
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.department IN ('HR', 'Admin', 'HR Admin')
        )
    );

CREATE POLICY "HR/Admin can manage employees"
    ON public.employees
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.department IN ('HR', 'Admin', 'HR Admin')
        )
    );

CREATE POLICY "Users can view own employee record"
    ON public.employees
    FOR SELECT
    USING (user_id = auth.uid());

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON public.employees TO authenticated;

-- Enable realtime (Idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND schemaname = 'public'
    AND tablename = 'employees'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.employees;
  END IF;
END
$$;


-- STEP 4: Sync existing tool users to employees
-- ============================================
INSERT INTO public.employees (user_id, first_name, last_name, email, is_tool_user, category)
SELECT 
    u.id,
    COALESCE(u.raw_user_meta_data->>'first_name', split_part(u.email, '@', 1)),
    COALESCE(u.raw_user_meta_data->>'last_name', ''),
    u.email,
    true,
    'office'
FROM auth.users u
WHERE u.id IS NOT NULL
ON CONFLICT (user_id) DO UPDATE
SET 
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    email = EXCLUDED.email,
    is_tool_user = true;


-- ============================================
-- DONE! Verify with these queries:
-- ============================================

-- Check employees count
SELECT COUNT(*) as total_employees FROM public.employees;

-- Check if email column exists in profiles
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'profiles' AND column_name = 'email';

-- View all employees
SELECT * FROM public.employees LIMIT 10;
