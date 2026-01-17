-- Direct SQL Script to Fix All Customer Issues
-- Run this directly in Supabase SQL Editor

-- 1. Drop and recreate get_customer_stats function
DROP FUNCTION IF EXISTS get_customer_stats(UUID);

CREATE FUNCTION get_customer_stats(p_customer_id UUID)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
  v_total_paid NUMERIC;
  v_opening_balance NUMERIC;
  v_pending_orders NUMERIC;
  v_orders_count INTEGER;
  v_pending_count INTEGER;
BEGIN
  -- Get opening balance and orders count
  SELECT opening_balance, orders_count 
  INTO v_opening_balance, v_orders_count
  FROM wc_customers 
  WHERE id = p_customer_id;
  
  -- Calculate total paid from ledger
  SELECT COALESCE(SUM(amount), 0)
  INTO v_total_paid
  FROM payment_ledger
  WHERE customer_id = p_customer_id
  AND transaction_type = 'CREDIT';
  
  -- Calculate pending orders amount
  SELECT 
    COALESCE(SUM(total_amount), 0),
    COUNT(*)
  INTO v_pending_orders, v_pending_count
  FROM orders
  WHERE customer_id = p_customer_id
  AND order_status NOT IN ('completed', 'cancelled', 'refunded');
  
  -- Return JSON object
  RETURN json_build_object(
    'total_paid', COALESCE(v_total_paid, 0),
    'lifetime_spent', COALESCE(v_opening_balance, 0),
    'pending_orders_amount', COALESCE(v_pending_orders, 0),
    'balance', COALESCE(v_total_paid, 0) - (COALESCE(v_opening_balance, 0) + COALESCE(v_pending_orders, 0)),
    'orders_count', COALESCE(v_orders_count, 0),
    'pending_orders_count', COALESCE(v_pending_count, 0)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_customer_stats TO authenticated;

-- 2. Create search index
CREATE INDEX IF NOT EXISTS idx_wc_customers_search 
ON wc_customers USING gin(to_tsvector('english', 
  COALESCE(first_name, '') || ' ' || 
  COALESCE(last_name, '') || ' ' || 
  COALESCE(email, '') || ' ' || 
  COALESCE(phone, '')
));

-- 3. Create assignment index
CREATE INDEX IF NOT EXISTS idx_wc_customers_assigned_to ON wc_customers(assigned_to);

-- 4. Fix RLS policy for customer updates
DROP POLICY IF EXISTS "Allow sales and admin to update customers" ON wc_customers;

CREATE POLICY "Allow sales and admin to update customers"
  ON wc_customers FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'sales', 'super_admin')
    )
  );

-- 5. Fix foreign key constraint
ALTER TABLE wc_customers DROP CONSTRAINT IF EXISTS wc_customers_assigned_to_fkey;

ALTER TABLE wc_customers 
ADD CONSTRAINT wc_customers_assigned_to_fkey 
FOREIGN KEY (assigned_to) 
REFERENCES profiles(id) 
ON DELETE SET NULL;

-- 6. Update customer_financial_summary view (without SECURITY DEFINER)
DROP VIEW IF EXISTS customer_financial_summary;

CREATE VIEW customer_financial_summary 
WITH (security_invoker = true)
AS
SELECT 
  wc.id,
  wc.email,
  wc.first_name,
  wc.last_name,
  COALESCE(wc.opening_balance, 0) as lifetime_spent,
  COALESCE(SUM(CASE WHEN pl.transaction_type = 'CREDIT' THEN pl.amount ELSE 0 END), 0) as total_paid,
  COALESCE(SUM(CASE 
    WHEN o.order_status NOT IN ('completed', 'cancelled', 'refunded') 
    THEN o.total_amount 
    ELSE 0 
  END), 0) as pending_orders_amount,
  (COALESCE(SUM(CASE WHEN pl.transaction_type = 'CREDIT' THEN pl.amount ELSE 0 END), 0) - 
   (COALESCE(wc.opening_balance, 0) + COALESCE(SUM(CASE 
     WHEN o.order_status NOT IN ('completed', 'cancelled', 'refunded') 
     THEN o.total_amount 
     ELSE 0 
   END), 0))) as balance,
  COALESCE(wc.orders_count, 0) as orders_count,
  COUNT(CASE 
    WHEN o.order_status NOT IN ('completed', 'cancelled', 'refunded') 
    THEN 1 
  END) as pending_orders_count
FROM wc_customers wc
LEFT JOIN payment_ledger pl ON pl.customer_id = wc.id
LEFT JOIN orders o ON o.customer_id = wc.id
GROUP BY wc.id, wc.email, wc.first_name, wc.last_name, wc.opening_balance, wc.orders_count;

GRANT SELECT ON customer_financial_summary TO authenticated;

-- Done! All fixes applied.
