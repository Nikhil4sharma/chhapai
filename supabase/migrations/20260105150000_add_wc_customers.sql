-- Create table for WooCommerce Customers
CREATE TABLE IF NOT EXISTS public.wc_customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wc_id INTEGER UNIQUE NOT NULL,
    email TEXT,
    first_name TEXT,
    last_name TEXT,
    phone TEXT,
    billing JSONB DEFAULT '{}'::jsonb,
    shipping JSONB DEFAULT '{}'::jsonb,
    avatar_url TEXT,
    total_spent DECIMAL(10, 2) DEFAULT 0.00,
    orders_count INTEGER DEFAULT 0,
    last_order_date TIMESTAMPTZ,
    last_synced_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.wc_customers ENABLE ROW LEVEL SECURITY;

-- Create policies
-- Admins and Sales can view all customers
CREATE POLICY "Admins and Sales can view wc_customers"
    ON public.wc_customers
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_roles.user_id = auth.uid()
            AND (user_roles.role = 'admin' OR user_roles.role = 'sales' OR user_roles.role = 'super_admin')
        )
    );

-- Only system/service role or admins can insert/update (for syncing)
-- Assuming the sync runs via Edge Function (service role) or Admin user triggers it
CREATE POLICY "Admins and Service Role can manage wc_customers"
    ON public.wc_customers
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_roles.user_id = auth.uid()
            AND (user_roles.role = 'admin' OR user_roles.role = 'super_admin')
        )
    );

-- Create index for faster search
CREATE INDEX IF NOT EXISTS idx_wc_customers_email ON public.wc_customers(email);
CREATE INDEX IF NOT EXISTS idx_wc_customers_phone ON public.wc_customers(phone);
CREATE INDEX IF NOT EXISTS idx_wc_customers_name ON public.wc_customers(first_name, last_name);
