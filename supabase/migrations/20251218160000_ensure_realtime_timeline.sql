-- Ensure timeline table has proper realtime setup
-- This ensures real-time updates work correctly for timeline entries

-- Add timeline to realtime publication if not already added
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'timeline'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.timeline;
  END IF;
END $$;

-- Set REPLICA IDENTITY FULL for timeline to enable realtime updates
-- This allows Supabase to track all changes including UPDATEs
ALTER TABLE public.timeline REPLICA IDENTITY FULL;

