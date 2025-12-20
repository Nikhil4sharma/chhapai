-- Add item_id field to order_items table for WooCommerce sync
-- This field stores the unique identifier for order items (e.g., "WC-123-456")
-- It's used to match items during sync operations

ALTER TABLE public.order_items 
ADD COLUMN IF NOT EXISTS item_id TEXT UNIQUE;

-- Create index on item_id for faster lookups during sync
CREATE INDEX IF NOT EXISTS idx_order_items_item_id ON public.order_items(item_id) WHERE item_id IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.order_items.item_id IS 'Unique identifier for order items, typically in format "ORDER_ID-LINE_ITEM_ID" for WooCommerce orders';

