-- 1. Ensure payment_ledger table exists
CREATE TABLE IF NOT EXISTS payment_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES wc_customers(id),
    order_id UUID REFERENCES orders(id),
    amount DECIMAL(10,2) NOT NULL,
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('CREDIT', 'DEBIT')),
    payment_method TEXT,
    reference_note TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB
);

-- Enable RLS
ALTER TABLE payment_ledger ENABLE ROW LEVEL SECURITY;

-- Policies for payment_ledger
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON payment_ledger;
CREATE POLICY "Enable read access for authenticated users" 
ON payment_ledger FOR SELECT 
TO authenticated 
USING (true);

DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON payment_ledger;
CREATE POLICY "Enable insert access for authenticated users" 
ON payment_ledger FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- 2. Create Missing Customers (Shadow Records)
-- Inserts wc_customers for orders that have email/name but no matching wc_customer record
-- Uses a negative random number for wc_id to avoid conflict with real WooCommerce IDs
INSERT INTO wc_customers (wc_id, email, first_name, last_name, phone, created_at, updated_at)
SELECT DISTINCT ON (o.customer_email)
    -1 * (floor(random() * 9000000)::bigint + 1000000 + (ROW_NUMBER() OVER (ORDER BY o.created_at))::bigint) as wc_id,
    o.customer_email,
    split_part(o.customer_name, ' ', 1) as first_name,
    substr(o.customer_name, length(split_part(o.customer_name, ' ', 1)) + 2) as last_name,
    o.customer_phone,
    NOW(),
    NOW()
FROM orders o
WHERE o.customer_id IS NULL 
AND o.customer_email IS NOT NULL 
AND o.customer_email <> ''
AND NOT EXISTS (
    SELECT 1 FROM wc_customers c WHERE lower(c.email) = lower(o.customer_email)
);

-- 3. Backfill Customer ID in Orders Table
-- This matches orders to customers by email (including the newly created ones)
UPDATE orders o
SET customer_id = c.id
FROM wc_customers c
WHERE o.customer_id IS NULL 
AND o.customer_email IS NOT NULL 
AND lower(o.customer_email) = lower(c.email);

-- 4. Verify Timeline Table
CREATE TABLE IF NOT EXISTS timeline (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(id),
    item_id UUID,
    stage TEXT,
    substage TEXT,
    action TEXT,
    performed_by UUID,
    performed_by_name TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    is_public BOOLEAN DEFAULT true
);

ALTER TABLE timeline ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'timeline' AND policyname = 'Enable all access for authenticated users'
    ) THEN
        CREATE POLICY "Enable all access for authenticated users"
        ON timeline FOR ALL
        TO authenticated
        USING (true)
        WITH CHECK (true);
    END IF;
END $$;
