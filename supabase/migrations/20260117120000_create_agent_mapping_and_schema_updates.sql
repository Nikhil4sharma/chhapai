-- Migration: Create sales_agent_mapping and update schema for robust Sync
-- Description: Adds tables and columns required for the automated WooCommerce sync system
-- Author: Antigravity

-- 1. Create sales_agent_mapping table
CREATE TABLE IF NOT EXISTS public.sales_agent_mapping (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sales_agent_code TEXT UNIQUE NOT NULL,
    user_email TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_sales_agent_mapping_code ON public.sales_agent_mapping(sales_agent_code);

-- RLS for sales_agent_mapping
ALTER TABLE public.sales_agent_mapping ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read access to authenticated users" 
ON public.sales_agent_mapping FOR SELECT 
TO authenticated 
USING (true);

-- Allow admins to manage mappings
CREATE POLICY "Allow admin to manage mappings" 
ON public.sales_agent_mapping FOR ALL 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
    )
);

-- 2. Seed Initial Mappings (Idempotent)
INSERT INTO public.sales_agent_mapping (sales_agent_code, user_email)
VALUES 
    ('work', 'work@chhapai.in'),
    ('nikhilsharma', 'chd+1@chhapai.in'),
    ('rohiniraina', 'rohini@chhapai.in')
ON CONFLICT (sales_agent_code) 
DO UPDATE SET user_email = EXCLUDED.user_email;

-- 3. Update orders table
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS raw_wc_payload JSONB,
ADD COLUMN IF NOT EXISTS sales_agent_code TEXT,
ADD COLUMN IF NOT EXISTS assigned_user_email TEXT;

-- 4. Update wc_customers table
ALTER TABLE public.wc_customers
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'woocommerce';
