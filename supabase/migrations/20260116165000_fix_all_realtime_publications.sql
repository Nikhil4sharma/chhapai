-- Fix all realtime publication duplicate errors
-- This migration ensures all tables are added to realtime publication safely

DO $$
DECLARE
    tables_to_add TEXT[] := ARRAY['leave_balances', 'leave_requests', 'employees'];
    table_name TEXT;
BEGIN
    FOREACH table_name IN ARRAY tables_to_add
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_tables 
            WHERE pubname = 'supabase_realtime' 
            AND schemaname = 'public' 
            AND tablename = table_name
        ) THEN
            EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', table_name);
            RAISE NOTICE 'Added % to realtime publication', table_name;
        ELSE
            RAISE NOTICE '% already in realtime publication, skipping', table_name;
        END IF;
    END LOOP;
END $$;
