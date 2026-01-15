-- Fix wc_customers RLS and Import Issues

-- 1. Ensure column definitions (idempotent)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'wc_customers' AND column_name = 'assigned_to') THEN
        ALTER TABLE public.wc_customers ADD COLUMN assigned_to uuid REFERENCES auth.users(id);
    END IF;
END $$;

-- 2. Reset RLS Policies completely to ensure no bad state
ALTER TABLE public.wc_customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read access to authenticated users" ON public.wc_customers;
DROP POLICY IF EXISTS "Allow insert/update access to service role only" ON public.wc_customers;
DROP POLICY IF EXISTS "Allow admin full access" ON public.wc_customers;
DROP POLICY IF EXISTS "Allow read access to assigned users" ON public.wc_customers;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.wc_customers;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.wc_customers;
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON public.wc_customers;
DROP POLICY IF EXISTS "Enable update access for authenticated users" ON public.wc_customers;
DROP POLICY IF EXISTS "Enable delete access for authenticated users" ON public.wc_customers;

-- 3. Create Permissive Policies (Since this is an internal tool for a team)

-- READ: Authenticated users (Sales, Admin, etc.) need to see customers to assigning them
CREATE POLICY "Enable read access for authenticated users"
ON public.wc_customers FOR SELECT
TO authenticated
USING (true);

-- INSERT: Authenticated users can import customers
CREATE POLICY "Enable insert access for authenticated users"
ON public.wc_customers FOR INSERT
TO authenticated
WITH CHECK (true);

-- UPDATE: Authenticated users (Sales) need to assign managers (update assigned_to)
CREATE POLICY "Enable update access for authenticated users"
ON public.wc_customers FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- DELETE: Authenticated users can delete customers
CREATE POLICY "Enable delete access for authenticated users"
ON public.wc_customers FOR DELETE
TO authenticated
USING (true);

-- SERVICE ROLE: Always full access
CREATE POLICY "Enable full access for service role"
ON public.wc_customers FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
