-- Fix payment_ledger FK to allow order deletion
-- This changes the constraint to SET NULL when an order is deleted

ALTER TABLE public.payment_ledger
DROP CONSTRAINT IF EXISTS payment_ledger_order_id_fkey;

ALTER TABLE public.payment_ledger
ADD CONSTRAINT payment_ledger_order_id_fkey
FOREIGN KEY (order_id)
REFERENCES public.orders(id)
ON DELETE SET NULL;
