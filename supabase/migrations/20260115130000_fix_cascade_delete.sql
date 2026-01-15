-- Migration to fix Foreign Key constraints to allow Cascading Deletes
-- This ensures that when an order is deleted, all related items, files, timeline entries, etc. are also deleted automatically.

DO $$
DECLARE
    constraint_name text;
BEGIN
    -- 1. FIX order_items
    -- Find existing FK constraint for order_id
    SELECT con.conname INTO constraint_name
    FROM pg_catalog.pg_constraint con
        INNER JOIN pg_catalog.pg_class rel ON rel.oid = con.conrelid
        INNER JOIN pg_catalog.pg_namespace nsp ON nsp.oid = connamespace
    WHERE nsp.nspname = 'public'
        AND rel.relname = 'order_items'
        AND con.contype = 'f'
        AND ARRAY[1::int2] = con.conkey -- Assuming order_id is the first column or we check column usage (simpler to just drop generic)
    LIMIT 1;
    
    -- Actually, safer to drop by iterating known FKs or just DROP IF EXISTS with standard names
    -- But since names are auto-generated if not specified, we use dynamic SQL to find and drop.
    
    FOR constraint_name IN (
        SELECT con.conname
        FROM pg_catalog.pg_constraint con
        JOIN pg_catalog.pg_class rel ON rel.oid = con.conrelid
        JOIN pg_catalog.pg_attribute att ON att.attrelid = rel.oid AND att.attnum = ANY(con.conkey)
        WHERE rel.relname = 'order_items' AND att.attname = 'order_id' AND con.contype = 'f'
    ) LOOP
        EXECUTE 'ALTER TABLE public.order_items DROP CONSTRAINT ' || constraint_name;
    END LOOP;

    -- Re-add with CASCADE
    ALTER TABLE public.order_items 
    ADD CONSTRAINT order_items_order_id_fkey 
    FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


    -- 2. FIX order_files
    FOR constraint_name IN (
        SELECT con.conname
        FROM pg_catalog.pg_constraint con
        JOIN pg_catalog.pg_class rel ON rel.oid = con.conrelid
        JOIN pg_catalog.pg_attribute att ON att.attrelid = rel.oid AND att.attnum = ANY(con.conkey)
        WHERE rel.relname = 'order_files' AND att.attname = 'order_id' AND con.contype = 'f'
    ) LOOP
        EXECUTE 'ALTER TABLE public.order_files DROP CONSTRAINT ' || constraint_name;
    END LOOP;

    ALTER TABLE public.order_files 
    ADD CONSTRAINT order_files_order_id_fkey 
    FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


    -- 3. FIX timeline
    FOR constraint_name IN (
        SELECT con.conname
        FROM pg_catalog.pg_constraint con
        JOIN pg_catalog.pg_class rel ON rel.oid = con.conrelid
        JOIN pg_catalog.pg_attribute att ON att.attrelid = rel.oid AND att.attnum = ANY(con.conkey)
        WHERE rel.relname = 'timeline' AND att.attname = 'order_id' AND con.contype = 'f'
    ) LOOP
        EXECUTE 'ALTER TABLE public.timeline DROP CONSTRAINT ' || constraint_name;
    END LOOP;

    ALTER TABLE public.timeline 
    ADD CONSTRAINT timeline_order_id_fkey 
    FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


    -- 4. FIX notifications
    FOR constraint_name IN (
        SELECT con.conname
        FROM pg_catalog.pg_constraint con
        JOIN pg_catalog.pg_class rel ON rel.oid = con.conrelid
        JOIN pg_catalog.pg_attribute att ON att.attrelid = rel.oid AND att.attnum = ANY(con.conkey)
        WHERE rel.relname = 'notifications' AND att.attname = 'order_id' AND con.contype = 'f'
    ) LOOP
        EXECUTE 'ALTER TABLE public.notifications DROP CONSTRAINT ' || constraint_name;
    END LOOP;

    -- Notifications order_id is nullable, but if set, it should reference orders
    
    -- STEP 4a: DATA CLEANUP (Fix invalid UUIDs before casting)
    -- Try to map existing legacy "order_id" (WC numbers) to actual Order UUIDs
    UPDATE public.notifications n
    SET order_id = o.id::text
    FROM public.orders o
    WHERE n.order_id = o.order_id::text
      AND n.order_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'; -- Regex check for UUID format

    -- STEP 4b: Nullify any remaining invalid UUIDs (orphaned records that can't be mapped)
    UPDATE public.notifications
    SET order_id = NULL
    WHERE order_id IS NOT NULL 
      AND order_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

    -- STEP 4c: Now safely cast to UUID
    ALTER TABLE public.notifications 
    ALTER COLUMN order_id TYPE uuid USING order_id::uuid;

    ALTER TABLE public.notifications 
    ADD CONSTRAINT notifications_order_id_fkey 
    FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;

    
    -- 5. FIX order_activity_logs (just to be sure, though it looked fine in recent migrations)
    FOR constraint_name IN (
        SELECT con.conname
        FROM pg_catalog.pg_constraint con
        JOIN pg_catalog.pg_class rel ON rel.oid = con.conrelid
        JOIN pg_catalog.pg_attribute att ON att.attrelid = rel.oid AND att.attnum = ANY(con.conkey)
        WHERE rel.relname = 'order_activity_logs' AND att.attname = 'order_id' AND con.contype = 'f'
    ) LOOP
        EXECUTE 'ALTER TABLE public.order_activity_logs DROP CONSTRAINT ' || constraint_name;
    END LOOP;

    ALTER TABLE public.order_activity_logs 
    ADD CONSTRAINT order_activity_logs_order_id_fkey 
    FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;

END $$;
