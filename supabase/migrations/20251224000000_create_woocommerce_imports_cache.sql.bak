-- WooCommerce Imports Cache Table
-- Provides idempotency and prevents duplicate imports
-- Ensures deterministic behavior for order imports

CREATE TABLE IF NOT EXISTS public.woocommerce_imports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    woocommerce_order_id INTEGER NOT NULL UNIQUE,
    order_number TEXT NOT NULL,
    sanitized_payload JSONB NOT NULL,
    imported_by UUID REFERENCES auth.users(id) NOT NULL,
    imported_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_woocommerce_imports_order_id ON public.woocommerce_imports(woocommerce_order_id);
CREATE INDEX IF NOT EXISTS idx_woocommerce_imports_order_number ON public.woocommerce_imports(order_number);
CREATE INDEX IF NOT EXISTS idx_woocommerce_imports_imported_by ON public.woocommerce_imports(imported_by);
CREATE INDEX IF NOT EXISTS idx_woocommerce_imports_imported_at ON public.woocommerce_imports(imported_at DESC);

-- Enable RLS
ALTER TABLE public.woocommerce_imports ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view their own imports
CREATE POLICY "Users can view their own imports"
    ON public.woocommerce_imports
    FOR SELECT
    USING (auth.uid() = imported_by);

-- Admin and sales can view all imports
CREATE POLICY "Admin and sales can view all imports"
    ON public.woocommerce_imports
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = auth.uid()
            AND role IN ('admin', 'sales')
        )
    );

-- Admin and sales can insert imports
CREATE POLICY "Admin and sales can insert imports"
    ON public.woocommerce_imports
    FOR INSERT
    WITH CHECK (
        auth.uid() = imported_by
        AND EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = auth.uid()
            AND role IN ('admin', 'sales')
        )
    );

-- Only admins can update/delete imports (for data integrity)
CREATE POLICY "Only admins can update imports"
    ON public.woocommerce_imports
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = auth.uid()
            AND role = 'admin'
        )
    );

CREATE POLICY "Only admins can delete imports"
    ON public.woocommerce_imports
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = auth.uid()
            AND role = 'admin'
        )
    );

-- Comments for documentation
COMMENT ON TABLE public.woocommerce_imports IS 'Cache table for WooCommerce order imports. Provides idempotency and prevents duplicate imports. Each WooCommerce order ID can only be imported once.';
COMMENT ON COLUMN public.woocommerce_imports.woocommerce_order_id IS 'WooCommerce order ID (unique identifier from WooCommerce API)';
COMMENT ON COLUMN public.woocommerce_imports.order_number IS 'Order number as displayed in WooCommerce (may differ from ID)';
COMMENT ON COLUMN public.woocommerce_imports.sanitized_payload IS 'Sanitized order data from WooCommerce (JSONB format)';
COMMENT ON COLUMN public.woocommerce_imports.imported_by IS 'User who imported this order';
COMMENT ON COLUMN public.woocommerce_imports.imported_at IS 'Timestamp when order was first imported';

