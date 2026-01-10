-- Add historical assignment columns to order_items
-- These columns track where an item was sent from when it goes for approval

DO $$ 
BEGIN
  -- Add previous_department column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'order_items' 
    AND column_name = 'previous_department'
  ) THEN
    ALTER TABLE public.order_items 
    ADD COLUMN previous_department TEXT;
  END IF;

  -- Add previous_assigned_to column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'order_items' 
    AND column_name = 'previous_assigned_to'
  ) THEN
    ALTER TABLE public.order_items 
    ADD COLUMN previous_assigned_to UUID REFERENCES auth.users(id);
    
    COMMENT ON COLUMN public.order_items.previous_assigned_to 
    IS 'Tracks the user who assigned the item for approval/review.';
  END IF;
END $$;
