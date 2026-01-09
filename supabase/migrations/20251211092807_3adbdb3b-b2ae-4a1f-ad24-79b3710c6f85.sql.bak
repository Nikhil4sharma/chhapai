-- Fix the view to use SECURITY INVOKER
DROP VIEW IF EXISTS public.orders_secure;

CREATE VIEW public.orders_secure
WITH (security_invoker = true)
AS
SELECT 
  id,
  order_id,
  customer_name,
  -- Mask sensitive customer data for non-sales/admin users
  CASE 
    WHEN has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'sales') 
    THEN customer_email 
    ELSE NULL 
  END AS customer_email,
  CASE 
    WHEN has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'sales') 
    THEN customer_phone 
    ELSE NULL 
  END AS customer_phone,
  CASE 
    WHEN has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'sales') 
    THEN customer_address 
    ELSE NULL 
  END AS customer_address,
  global_notes,
  priority,
  delivery_date,
  source,
  is_completed,
  created_by,
  created_at,
  updated_at
FROM public.orders;