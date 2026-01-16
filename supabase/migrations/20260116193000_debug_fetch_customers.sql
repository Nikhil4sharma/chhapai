-- Debug Fetch Customers RPC (Security Definer to bypass RLS)
CREATE OR REPLACE FUNCTION debug_fetch_customers()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN (SELECT jsonb_agg(t) FROM (
     SELECT id, first_name, last_name, email, assigned_to, created_at FROM wc_customers ORDER BY created_at DESC LIMIT 5
  ) t);
END;
$$;
