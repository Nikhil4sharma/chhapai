-- Add last_workflow_note column to order_items table
-- This column stores the most recent workflow note/instruction for the item

DO $$ 
BEGIN
  -- Add last_workflow_note column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'order_items' 
    AND column_name = 'last_workflow_note'
  ) THEN
    ALTER TABLE public.order_items 
    ADD COLUMN last_workflow_note TEXT;
    
    COMMENT ON COLUMN public.order_items.last_workflow_note 
    IS 'Most recent workflow note/instruction for this item. May include [APPROVE] or [REJECT] prefixes.';
  END IF;
END $$;
