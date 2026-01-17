-- Fix Customer Financial Logic
-- Lifetime Spent = Opening Balance (historical completed orders)
-- Total Paid = Sum from payment ledger
-- Pending Orders = Orders in flow (not completed)

-- 1. Remove incorrect trigger for total_spent
DROP TRIGGER IF EXISTS trigger_update_total_spent ON orders;
DROP FUNCTION IF EXISTS update_customer_total_spent();

-- 2. Update get_customer_stats function with correct logic
CREATE OR REPLACE FUNCTION get_customer_stats(p_customer_id UUID)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_paid', COALESCE(SUM(CASE WHEN pl.transaction_type = 'CREDIT' THEN pl.amount ELSE 0 END), 0),
    'lifetime_spent', wc.opening_balance,
    'pending_orders_amount', COALESCE(SUM(CASE 
      WHEN o.order_status NOT IN ('completed', 'cancelled', 'refunded') 
      THEN o.total_amount 
      ELSE 0 
    END), 0),
    'balance', (COALESCE(SUM(CASE WHEN pl.transaction_type = 'CREDIT' THEN pl.amount ELSE 0 END), 0) - 
     (wc.opening_balance + COALESCE(SUM(CASE 
       WHEN o.order_status NOT IN ('completed', 'cancelled', 'refunded') 
       THEN o.total_amount 
       ELSE 0 
     END), 0))),
    'orders_count', wc.orders_count,
    'pending_orders_count', COUNT(CASE 
      WHEN o.order_status NOT IN ('completed', 'cancelled', 'refunded') 
      THEN 1 
    END)
  ) INTO result
  FROM wc_customers wc
  LEFT JOIN payment_ledger pl ON pl.customer_id = wc.id
  LEFT JOIN orders o ON o.customer_id = wc.id
  WHERE wc.id = p_customer_id
  GROUP BY wc.id, wc.opening_balance, wc.orders_count;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION get_customer_stats TO authenticated;

-- 3. Update wc_customers to use opening_balance as total_spent
-- This ensures backward compatibility with existing UI
UPDATE wc_customers
SET total_spent = opening_balance
WHERE opening_balance > 0;

-- 4. Create view for easy customer financial summary
CREATE OR REPLACE VIEW customer_financial_summary AS
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

-- 5. Add comment to clarify the logic
COMMENT ON COLUMN wc_customers.opening_balance IS 'Historical completed orders amount (lifetime spent). This is the total amount customer has paid for completed orders before using this system.';
COMMENT ON COLUMN wc_customers.total_spent IS 'Deprecated: Use opening_balance instead. Kept for backward compatibility.';
