-- Fix get_customer_stats function error and customer issues
-- Drop existing function first to change return type

DROP FUNCTION IF EXISTS get_customer_stats(UUID);

-- Recreate with JSON return type
CREATE OR REPLACE FUNCTION get_customer_stats(p_customer_id UUID)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_paid', COALESCE(SUM(CASE WHEN pl.transaction_type = 'CREDIT' THEN pl.amount ELSE 0 END), 0),
    'lifetime_spent', COALESCE(wc.opening_balance, 0),
    'pending_orders_amount', COALESCE(SUM(CASE 
      WHEN o.order_status NOT IN ('completed', 'cancelled', 'refunded') 
      THEN o.total_amount 
      ELSE 0 
    END), 0),
    'balance', (COALESCE(SUM(CASE WHEN pl.transaction_type = 'CREDIT' THEN pl.amount ELSE 0 END), 0) - 
     (COALESCE(wc.opening_balance, 0) + COALESCE(SUM(CASE 
       WHEN o.order_status NOT IN ('completed', 'cancelled', 'refunded') 
       THEN o.total_amount 
       ELSE 0 
     END), 0))),
    'orders_count', COALESCE(wc.orders_count, 0),
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

-- Fix customer search - ensure proper indexes and text search
CREATE INDEX IF NOT EXISTS idx_wc_customers_search 
ON wc_customers USING gin(to_tsvector('english', 
  COALESCE(first_name, '') || ' ' || 
  COALESCE(last_name, '') || ' ' || 
  COALESCE(email, '') || ' ' || 
  COALESCE(phone, '')
));

-- Create index for faster assignment queries
CREATE INDEX IF NOT EXISTS idx_wc_customers_assigned_to ON wc_customers(assigned_to);

-- Ensure RLS policies allow assignment updates
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

-- Ensure assigned_to foreign key is correct
DO $$
BEGIN
  -- Check if constraint exists and drop it
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'wc_customers_assigned_to_fkey' 
    AND table_name = 'wc_customers'
  ) THEN
    ALTER TABLE wc_customers DROP CONSTRAINT wc_customers_assigned_to_fkey;
  END IF;
  
  -- Add correct foreign key with ON DELETE SET NULL
  ALTER TABLE wc_customers 
  ADD CONSTRAINT wc_customers_assigned_to_fkey 
  FOREIGN KEY (assigned_to) 
  REFERENCES profiles(id) 
  ON DELETE SET NULL;
END $$;
