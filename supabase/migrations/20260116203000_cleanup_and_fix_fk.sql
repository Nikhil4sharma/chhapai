-- Migration to cleanup invalid assigned_to/assigned_user references and fix Foreign Key constraints

DO $$ 
BEGIN
  -- 1. CLEANUP: wc_customers
  -- Set assigned_to to NULL if the ID does not exist in public.profiles
  UPDATE public.wc_customers
  SET assigned_to = NULL
  WHERE assigned_to IS NOT NULL 
  AND assigned_to NOT IN (SELECT id FROM public.profiles);
  
  -- 2. CLEANUP: orders
  -- Set assigned_user to NULL if the ID does not exist in public.profiles
  -- We check strict existence to avoid FK violations
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'assigned_user') THEN
     UPDATE public.orders
     SET assigned_user = NULL
     WHERE assigned_user IS NOT NULL 
     AND assigned_user NOT IN (SELECT id FROM public.profiles);
  END IF;

  -- 3. Update wc_customers Foreign Key
  -- Drop existing if it exists (might check constraint name dynamically or just IF EXISTS)
  BEGIN
    ALTER TABLE public.wc_customers DROP CONSTRAINT IF EXISTS wc_customers_assigned_to_fkey;
  EXCEPTION WHEN OTHERS THEN NULL; END;

  -- Add new constraint referencing profiles
  ALTER TABLE public.wc_customers
  ADD CONSTRAINT wc_customers_assigned_to_fkey
  FOREIGN KEY (assigned_to)
  REFERENCES public.profiles(id);

  -- 4. Update orders Foreign Key
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'assigned_user') THEN
    BEGIN
        ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_assigned_user_fkey;
    EXCEPTION WHEN OTHERS THEN NULL; END;

    ALTER TABLE public.orders 
    ADD CONSTRAINT orders_assigned_user_fkey 
    FOREIGN KEY (assigned_user) 
    REFERENCES public.profiles(id);
  END IF;

END $$;
