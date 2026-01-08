-- Fix Foreign Key Constraints for Customer Deletion (Robust)

-- 1. Fix 'public.orders' foreign key (Enable SET NULL)
DO $$ 
BEGIN
    -- Check if constraint exists, if so drop it
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_customer_id_fkey') THEN
        ALTER TABLE public.orders DROP CONSTRAINT orders_customer_id_fkey;
    END IF;
END $$;

ALTER TABLE public.orders
ADD CONSTRAINT orders_customer_id_fkey
FOREIGN KEY (customer_id)
REFERENCES public.wc_customers(id)
ON DELETE SET NULL;


-- 2. Fix 'public.payment_ledger' foreign key (Enable CASCADE)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payment_ledger_customer_id_fkey') THEN
        ALTER TABLE public.payment_ledger DROP CONSTRAINT payment_ledger_customer_id_fkey;
    END IF;
END $$;

-- Also check for auto-generated naming if manually named constraint doesn't exist? 
-- Usually Postgres names it <table>_<column>_fkey. 
-- Just in case correct the existing table column to be safe.

ALTER TABLE public.payment_ledger
ADD CONSTRAINT payment_ledger_customer_id_fkey
FOREIGN KEY (customer_id)
REFERENCES public.wc_customers(id)
ON DELETE CASCADE;

-- 3. Check for any other tables (just in case)
-- If there are other tables preventing deletion, they would need manual intervention or generic approach.
-- For now, these are the confirmed two dependencies.
