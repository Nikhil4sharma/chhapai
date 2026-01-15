-- Add gst_number to wc_customers table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'wc_customers' AND column_name = 'gst_number') THEN
        ALTER TABLE wc_customers ADD COLUMN gst_number text;
    END IF;
END $$;
