-- Migration: Create HR Admin Department and Employee Sync
-- Created: 2026-01-15
-- Purpose: Setup HR Admin as separate department and auto-sync tool users as employees

-- Note: HR Admin is a department value, not a table entry
-- Users with department = 'HR Admin' will have access to HR dashboard only

-- Create employees table for all staff (tool users + non-tool users)
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

-- Enable RLS
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "HR/Admin can view all employees" ON public.employees;
DROP POLICY IF EXISTS "HR/Admin can manage employees" ON public.employees;
DROP POLICY IF EXISTS "Users can view own employee record" ON public.employees;

-- RLS Policies
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

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_employees_updated_at ON public.employees;
CREATE TRIGGER update_employees_updated_at
    BEFORE UPDATE ON public.employees
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.employees;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON public.employees TO authenticated;

-- Sync existing tool users to employees table
-- Note: Using auth.users for email and basic info, profiles for department
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
