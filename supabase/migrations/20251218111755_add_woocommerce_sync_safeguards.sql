-- Advanced Order Sync Safeguards Migration
-- Adds fields and tables for safe WooCommerce order synchronization

-- Add sync tracking fields to orders table
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS archived_from_wc BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS last_seen_in_wc_sync TIMESTAMP WITH TIME ZONE;

-- Create order_sync_logs table to track sync operations
CREATE TABLE IF NOT EXISTS public.order_sync_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sync_id TEXT NOT NULL UNIQUE,
    synced_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    woo_order_ids INTEGER[] NOT NULL DEFAULT '{}',
    sync_status TEXT NOT NULL DEFAULT 'completed', -- 'completed', 'failed', 'partial'
    imported_count INTEGER NOT NULL DEFAULT 0,
    updated_count INTEGER NOT NULL DEFAULT 0,
    archived_count INTEGER NOT NULL DEFAULT 0,
    restored_count INTEGER NOT NULL DEFAULT 0,
    errors JSONB DEFAULT '[]'::jsonb,
    performed_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index on sync_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_order_sync_logs_sync_id ON public.order_sync_logs(sync_id);
CREATE INDEX IF NOT EXISTS idx_order_sync_logs_synced_at ON public.order_sync_logs(synced_at DESC);

-- Create index on woo_order_id for faster sync lookups
CREATE INDEX IF NOT EXISTS idx_orders_woo_order_id ON public.orders(woo_order_id) WHERE woo_order_id IS NOT NULL;

-- Create index on source and archived_from_wc for filtering
CREATE INDEX IF NOT EXISTS idx_orders_source_archived ON public.orders(source, archived_from_wc) WHERE archived_from_wc = false;

-- Add comment for documentation
COMMENT ON COLUMN public.orders.archived_from_wc IS 'True if order was archived from WooCommerce sync (not found in latest sync). Order is preserved but hidden from Sales view.';
COMMENT ON COLUMN public.orders.last_seen_in_wc_sync IS 'Timestamp when order was last seen in a WooCommerce sync operation. Used to detect missing orders.';
COMMENT ON TABLE public.order_sync_logs IS 'Logs all WooCommerce sync operations with details about imported, updated, archived, and restored orders.';

-- Ensure source field has proper constraint (if not already exists)
-- Note: This assumes source can be 'manual', 'woocommerce', or 'wordpress'
-- We'll add a check constraint to enforce valid values
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'orders_source_check'
    ) THEN
        ALTER TABLE public.orders 
        ADD CONSTRAINT orders_source_check 
        CHECK (source IN ('manual', 'woocommerce', 'wordpress'));
    END IF;
END $$;

