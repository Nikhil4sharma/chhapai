-- Add imported_by column to orders table for tracking manual imports
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS imported_by UUID REFERENCES auth.users(id);

-- Add comment for documentation
COMMENT ON COLUMN public.orders.imported_by IS 'User who manually imported this order from WooCommerce. NULL for manually created orders.';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_orders_imported_by ON public.orders(imported_by) WHERE imported_by IS NOT NULL;

-- Ensure unique constraint on woo_order_id to prevent duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_woo_order_id_unique ON public.orders(woo_order_id) WHERE woo_order_id IS NOT NULL;

