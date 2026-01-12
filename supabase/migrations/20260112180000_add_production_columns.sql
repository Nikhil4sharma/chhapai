-- Add missing production columns to order_items
DO $$ 
BEGIN
    -- substage_status
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'order_items' AND column_name = 'substage_status') THEN
        ALTER TABLE public.order_items ADD COLUMN substage_status text;
    END IF;

    -- substage_user
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'order_items' AND column_name = 'substage_user') THEN
        ALTER TABLE public.order_items ADD COLUMN substage_user uuid REFERENCES auth.users(id);
    END IF;

    -- substage_started_at
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'order_items' AND column_name = 'substage_started_at') THEN
        ALTER TABLE public.order_items ADD COLUMN substage_started_at timestamp with time zone;
    END IF;

    -- substage_completed_at
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'order_items' AND column_name = 'substage_completed_at') THEN
        ALTER TABLE public.order_items ADD COLUMN substage_completed_at timestamp with time zone;
    END IF;

    -- production_notes
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'order_items' AND column_name = 'production_notes') THEN
        ALTER TABLE public.order_items ADD COLUMN production_notes text;
    END IF;
END $$;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_order_items_substage_status ON public.order_items(substage_status);

-- Force cache reload
NOTIFY pgrst, 'reload config';
