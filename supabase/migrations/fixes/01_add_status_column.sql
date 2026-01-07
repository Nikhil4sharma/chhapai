-- Migration to add 'status' column to 'order_items' table
-- Fixes 400 Bad Request error when updating order status

DO $$ 
BEGIN
  -- Add status column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'order_items' 
                 AND column_name = 'status') THEN
    ALTER TABLE public.order_items ADD COLUMN status TEXT;
    COMMENT ON COLUMN public.order_items.status IS 'Current status of the item (e.g., new_order, design_in_progress)';
  END IF;

  -- Optional: Backfill status from some source if needed, or default to 'new_order'
  -- UPDATE public.order_items SET status = 'new_order' WHERE status IS NULL;
END $$;
