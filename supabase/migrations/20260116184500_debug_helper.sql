-- Debug Helper Function
CREATE OR REPLACE FUNCTION get_debug_info()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'users', (SELECT jsonb_agg(row_to_json(p)) FROM (SELECT id, full_name, email, department FROM profiles) p),
    'wc_customers_cols', (SELECT jsonb_agg(column_name) FROM information_schema.columns WHERE table_name = 'wc_customers'),
    'orders_cols', (SELECT jsonb_agg(column_name) FROM information_schema.columns WHERE table_name = 'orders')
  ) INTO result;
  
  RETURN result;
END;
$$;
