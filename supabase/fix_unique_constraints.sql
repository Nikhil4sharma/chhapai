-- FIX: "no unique or exclusion constraint matching the ON CONFLICT specification"
-- This script does 2 things:
-- 1. Removes duplicate records (if any) that would prevent UNIQUE constraints.
-- 2. Adds the missing UNIQUE constraints on wc_customer_id and wc_order_id.

-- A. Clean up duplicates in wc_customers
DELETE FROM wc_customers
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY wc_customer_id ORDER BY created_at DESC) as rn
    FROM wc_customers
    WHERE wc_customer_id IS NOT NULL
  ) t
  WHERE t.rn > 1
);

-- B. Clean up duplicates in orders (by wc_order_id)
DELETE FROM orders
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY wc_order_id ORDER BY created_at DESC) as rn
    FROM orders
    WHERE wc_order_id IS NOT NULL AND wc_order_id != ''
  ) t
  WHERE t.rn > 1
);

-- C. Add UNIQUE constraint to wc_customers
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'wc_customers_wc_customer_id_key') THEN
        ALTER TABLE wc_customers ADD CONSTRAINT wc_customers_wc_customer_id_key UNIQUE (wc_customer_id);
    END IF;
END $$;

-- D. Add UNIQUE constraint to orders
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_wc_order_id_key') THEN
        ALTER TABLE orders ADD CONSTRAINT orders_wc_order_id_key UNIQUE (wc_order_id);
    END IF;
END $$;
