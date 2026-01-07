-- Add assigned_to column to wc_customers table
ALTER TABLE public.wc_customers 
ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES auth.users(id);

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_wc_customers_assigned_to ON public.wc_customers(assigned_to);

-- Update RLS policies (if any exist, ensure sales can see assigned customers)
-- Assuming RLS is enabled, we might need to adjust policies. 
-- For now, let's assume public/sales access is handled, but adding a specific policy is good practice.

-- Example Policy (Enable if RLS is strict)
-- CREATE POLICY "Sales can view assigned customers" ON wc_customers
-- FOR SELECT USING (assigned_to = auth.uid());
