
-- Create payment_transaction_type enum
CREATE TYPE public.payment_transaction_type AS ENUM ('CREDIT', 'DEBIT');

-- Create payment_ledger table
CREATE TABLE IF NOT EXISTS public.payment_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES public.wc_customers(id) ON DELETE CASCADE,
    order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL, -- FK to internal order UUID
    amount DECIMAL(12, 2) NOT NULL,
    transaction_type public.payment_transaction_type NOT NULL,
    payment_method TEXT NOT NULL, -- 'cash', 'upi', 'bank', 'online'
    reference_note TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_payment_ledger_customer_id ON public.payment_ledger(customer_id);
CREATE INDEX IF NOT EXISTS idx_payment_ledger_order_id ON public.payment_ledger(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_ledger_created_at ON public.payment_ledger(created_at);

-- RLS Policies
ALTER TABLE public.payment_ledger ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users (Sales/Admin) to insert
CREATE POLICY "Authenticated users can insert ledger entries"
ON public.payment_ledger
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow authenticated users to view
CREATE POLICY "Authenticated users can view ledger entries"
ON public.payment_ledger
FOR SELECT
TO authenticated
USING (true);

-- Prevent Updates and Deletes (Immutable Ledger)
-- No UPDATE policy = Updates denied by default
-- No DELETE policy = Deletes denied by default
