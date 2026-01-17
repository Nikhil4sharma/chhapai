-- COMPREHENSIVE FIX for Creation Error & Security Warning
-- 1. Fixes "no unique or exclusion constraint" by cleaning duplicates and adding constraints.
-- 2. Fixes "Security Definer View" warning by enabling security_invoker.

-- =========================================================
-- PART 1: Fix Constraint Error (wc_customers & orders)
-- =========================================================

-- 1.A. Clean up duplicates in wc_customers (keeping the latest one)
DELETE FROM wc_customers
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY wc_customer_id ORDER BY created_at DESC) as rn
    FROM wc_customers
    WHERE wc_customer_id IS NOT NULL
  ) t
  WHERE t.rn > 1
);

-- 1.B. Clean up duplicates in orders (keeping the latest one)
DELETE FROM orders
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY wc_order_id ORDER BY created_at DESC) as rn
    FROM orders
    WHERE wc_order_id IS NOT NULL AND wc_order_id != ''
  ) t
  WHERE t.rn > 1
);

-- 1.C. Add / Ensure UNIQUE constraint on wc_customers(wc_customer_id)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'wc_customers_wc_customer_id_key') THEN
        ALTER TABLE wc_customers ADD CONSTRAINT wc_customers_wc_customer_id_key UNIQUE (wc_customer_id);
    END IF;
END $$;

-- 1.D. Add / Ensure UNIQUE constraint on orders(wc_order_id)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_wc_order_id_key') THEN
        ALTER TABLE orders ADD CONSTRAINT orders_wc_order_id_key UNIQUE (wc_order_id);
    END IF;
END $$;

-- =========================================================
-- PART 2: Fix Security Definer View Warning
-- =========================================================

-- Recreate the view with (security_invoker = true) so it respects RLS
CREATE OR REPLACE VIEW customer_financial_summary
WITH (security_invoker = true)
AS
SELECT 
  wc.id,
  wc.email,
  wc.first_name,
  wc.last_name,
  wc.opening_balance as lifetime_spent,
  COALESCE(SUM(CASE WHEN pl.transaction_type = 'CREDIT' THEN pl.amount ELSE 0 END), 0) as total_paid,
  COALESCE(SUM(CASE 
    WHEN o.order_status NOT IN ('completed', 'cancelled', 'refunded') 
    THEN o.total_amount 
    ELSE 0 
  END), 0) as pending_orders_amount,
  (COALESCE(SUM(CASE WHEN pl.transaction_type = 'CREDIT' THEN pl.amount ELSE 0 END), 0) - 
   (wc.opening_balance + COALESCE(SUM(CASE 
     WHEN o.order_status NOT IN ('completed', 'cancelled', 'refunded') 
     THEN o.total_amount 
     ELSE 0 
   END), 0))) as balance,
  wc.orders_count,
  COUNT(CASE 
    WHEN o.order_status NOT IN ('completed', 'cancelled', 'refunded') 
    THEN 1 
  END) as pending_orders_count
FROM wc_customers wc
LEFT JOIN payment_ledger pl ON pl.customer_id = wc.id
LEFT JOIN orders o ON o.customer_id = wc.id
GROUP BY wc.id, wc.email, wc.first_name, wc.last_name, wc.opening_balance, wc.orders_count;

GRANT SELECT ON customer_financial_summary TO authenticated;
