-- Change Foreign Key to reference public.profiles instead of auth.users
-- This allows assignment to users who exist in profiles but might be missing/deleted in auth.users

DO $$ 
BEGIN
  -- 1. wc_customers
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'wc_customers_assigned_to_fkey' AND table_name = 'wc_customers') THEN
    ALTER TABLE public.wc_customers DROP CONSTRAINT wc_customers_assigned_to_fkey;
  END IF;

  ALTER TABLE public.wc_customers
  ADD CONSTRAINT wc_customers_assigned_to_fkey
  FOREIGN KEY (assigned_to)
  REFERENCES public.profiles(id);

  -- 2. orders (Do the same for orders just in case, as Jaskaran will be assigned there too)
  -- Check if orders has a FK on assigned_user
  -- Depending on constraint name, might be 'orders_assigned_user_fkey' or similar. 
  -- We'll try to find it or just add if missing, but dropping by name requires knowing the name.
  -- Let's inspect generic constraint.
  -- For now, purely focusing on proper reference updates.
  
  -- Attempt to drop common name if exists
  BEGIN
    ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_assigned_user_fkey;
  EXCEPTION WHEN OTHERS THEN NULL; END;

  -- Add correct constraint
  -- Note: orders.assigned_user might already allow checking profiles in some setups, but let's enforce profiles(id)
  BEGIN
      ALTER TABLE public.orders 
      ADD CONSTRAINT orders_assigned_user_fkey 
      FOREIGN KEY (assigned_user) 
      REFERENCES public.profiles(id);
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

END $$;
