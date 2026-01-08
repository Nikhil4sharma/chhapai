-- Fix 409 Conflict when deleting customers
-- The existing constraint prevents deletion if orders exist.
-- We want to keep the orders but unlink them (set customer_id to NULL).

ALTER TABLE public.orders
DROP CONSTRAINT IF EXISTS orders_customer_id_fkey;

ALTER TABLE public.orders
ADD CONSTRAINT orders_customer_id_fkey
FOREIGN KEY (customer_id)
REFERENCES public.wc_customers(id)
ON DELETE SET NULL;
