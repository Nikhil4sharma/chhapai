-- Fix ui_modules check constraint to include 'order_details_item'
ALTER TABLE public.ui_modules DROP CONSTRAINT IF EXISTS ui_modules_page_type_check;
ALTER TABLE public.ui_modules ADD CONSTRAINT ui_modules_page_type_check 
    CHECK (page_type IN ('product_card', 'order_details', 'order_details_item'));

-- Ensure notifications table structure is correct and consistent with frontend
-- The frontend uses 'read' but migration added 'is_read'. We ensure 'read' exists.
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'read') THEN
        ALTER TABLE public.notifications ADD COLUMN "read" BOOLEAN DEFAULT false;
    END IF;
END $$;

-- Drop is_read if it is redundant/confusing (optional, but good for cleanup)
-- ALTER TABLE public.notifications DROP COLUMN IF EXISTS is_read; -- Keeping for safety for now

-- Verify RLS for notifications to prevent access errors masking as 400
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
CREATE POLICY "Users can view their own notifications"
    ON public.notifications FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
CREATE POLICY "Users can update their own notifications"
    ON public.notifications FOR UPDATE
    USING (auth.uid() = user_id);
