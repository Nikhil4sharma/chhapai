-- Enable Realtime for payment_ledger table
-- This allows the OrderContext to receive updates when payments are added

-- Check if publication exists, if not create it (standard supabase setup usually has it)
-- We just need to add the table to the publication

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND schemaname = 'public'
    AND tablename = 'payment_ledger'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.payment_ledger;
  END IF;
END
$$;
