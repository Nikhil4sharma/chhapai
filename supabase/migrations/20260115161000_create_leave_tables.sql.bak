-- Migration: Create Leave Management Tables
-- Created: 2026-01-15
-- Purpose: Enable leave tracking, balances, and requests for employees

-- Create leave_types table
CREATE TABLE IF NOT EXISTS public.leave_types (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL UNIQUE,
    days_allowed_per_year numeric(5, 2) NOT NULL DEFAULT 0,
    is_carry_forward boolean DEFAULT false,
    color text DEFAULT '#6366f1',
    description text,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create leave_balances table
CREATE TABLE IF NOT EXISTS public.leave_balances (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    leave_type_id uuid REFERENCES public.leave_types(id) ON DELETE CASCADE NOT NULL,
    year integer NOT NULL,
    balance numeric(5, 2) DEFAULT 0 NOT NULL,
    used numeric(5, 2) DEFAULT 0 NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    UNIQUE(user_id, leave_type_id, year),
    CHECK (balance >= 0),
    CHECK (used >= 0)
);

-- Create leave_requests table
CREATE TABLE IF NOT EXISTS public.leave_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    leave_type_id uuid REFERENCES public.leave_types(id) ON DELETE RESTRICT NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    days_count numeric(5, 2) NOT NULL,
    reason text,
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
    approved_by uuid REFERENCES auth.users(id),
    approved_at timestamptz,
    rejection_reason text,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    CHECK (end_date >= start_date),
    CHECK (days_count > 0)
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_leave_balances_user_id ON public.leave_balances(user_id);
CREATE INDEX IF NOT EXISTS idx_leave_balances_year ON public.leave_balances(year);
CREATE INDEX IF NOT EXISTS idx_leave_requests_user_id ON public.leave_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON public.leave_requests(status);
CREATE INDEX IF NOT EXISTS idx_leave_requests_dates ON public.leave_requests(start_date, end_date);

-- Enable Row Level Security
ALTER TABLE public.leave_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Anyone can view leave types" ON public.leave_types;
DROP POLICY IF EXISTS "HR/Admin can manage leave types" ON public.leave_types;
DROP POLICY IF EXISTS "Users can view own leave balances" ON public.leave_balances;
DROP POLICY IF EXISTS "HR/Admin can view all leave balances" ON public.leave_balances;
DROP POLICY IF EXISTS "HR/Admin can manage leave balances" ON public.leave_balances;
DROP POLICY IF EXISTS "Users can view own leave requests" ON public.leave_requests;
DROP POLICY IF EXISTS "Users can create leave requests" ON public.leave_requests;
DROP POLICY IF EXISTS "HR/Admin can view all leave requests" ON public.leave_requests;
DROP POLICY IF EXISTS "HR/Admin can update leave requests" ON public.leave_requests;

-- Leave Types Policies
CREATE POLICY "Anyone can view leave types"
    ON public.leave_types
    FOR SELECT
    USING (true);

CREATE POLICY "HR/Admin can manage leave types"
    ON public.leave_types
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.department IN ('HR', 'Admin')
        )
    );

-- Leave Balances Policies
CREATE POLICY "Users can view own leave balances"
    ON public.leave_balances
    FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "HR/Admin can view all leave balances"
    ON public.leave_balances
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.department IN ('HR', 'Admin')
        )
    );

CREATE POLICY "HR/Admin can manage leave balances"
    ON public.leave_balances
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.department IN ('HR', 'Admin')
        )
    );

-- Leave Requests Policies
CREATE POLICY "Users can view own leave requests"
    ON public.leave_requests
    FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can create leave requests"
    ON public.leave_requests
    FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "HR/Admin can view all leave requests"
    ON public.leave_requests
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.department IN ('HR', 'Admin')
        )
    );

CREATE POLICY "HR/Admin can update leave requests"
    ON public.leave_requests
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.department IN ('HR', 'Admin')
        )
    );

-- Create triggers for updated_at
DROP TRIGGER IF EXISTS update_leave_types_updated_at ON public.leave_types;
CREATE TRIGGER update_leave_types_updated_at
    BEFORE UPDATE ON public.leave_types
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_leave_balances_updated_at ON public.leave_balances;
CREATE TRIGGER update_leave_balances_updated_at
    BEFORE UPDATE ON public.leave_balances
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_leave_requests_updated_at ON public.leave_requests;
CREATE TRIGGER update_leave_requests_updated_at
    BEFORE UPDATE ON public.leave_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.leave_balances;
ALTER PUBLICATION supabase_realtime ADD TABLE public.leave_requests;

-- Grant permissions
GRANT SELECT ON public.leave_types TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.leave_balances TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.leave_requests TO authenticated;

-- Insert default leave types
INSERT INTO public.leave_types (name, days_allowed_per_year, is_carry_forward, color, description)
VALUES 
    ('Casual Leave', 12, false, '#3b82f6', 'For personal matters and short breaks'),
    ('Sick Leave', 10, false, '#ef4444', 'For medical reasons and health issues'),
    ('Earned Leave', 15, true, '#10b981', 'Earned leave that can be carried forward'),
    ('Maternity Leave', 180, false, '#ec4899', 'For maternity purposes'),
    ('Paternity Leave', 15, false, '#8b5cf6', 'For paternity purposes')
ON CONFLICT (name) DO NOTHING;
