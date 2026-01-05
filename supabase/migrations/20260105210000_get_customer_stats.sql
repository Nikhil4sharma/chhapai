-- Update function to key by lowercase email for better matching
CREATE OR REPLACE FUNCTION get_customer_stats()
RETURNS TABLE (
  email text,
  total_spent numeric,
  orders_count bigint,
  last_order_date timestamptz
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    LOWER(o.customer_email) as email,
    COALESCE(SUM(o.order_total), 0) as total_spent,
    COUNT(*) as orders_count,
    MAX(o.created_at) as last_order_date
  FROM 
    orders o
  WHERE 
    o.customer_email IS NOT NULL AND o.customer_email != ''
  GROUP BY 
    LOWER(o.customer_email);
END;
$$;
