-- Fix: Set orders_secure view to SECURITY INVOKER to respect user's RLS
DROP VIEW IF EXISTS public.orders_secure;

CREATE VIEW public.orders_secure 
WITH (security_invoker = true) AS
SELECT 
  id,
  order_id,
  customer_name,
  CASE 
    WHEN has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'sales'::app_role) 
    THEN customer_email
    ELSE NULL
  END as customer_email,
  CASE 
    WHEN has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'sales'::app_role) 
    THEN customer_phone
    ELSE NULL
  END as customer_phone,
  CASE 
    WHEN has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'sales'::app_role) 
    THEN customer_address
    ELSE NULL
  END as customer_address,
  delivery_date,
  priority,
  source,
  is_completed,
  created_by,
  created_at,
  updated_at,
  global_notes,
  CASE 
    WHEN has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'sales'::app_role) 
    THEN billing_city
    ELSE NULL
  END as billing_city,
  CASE 
    WHEN has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'sales'::app_role) 
    THEN billing_state
    ELSE NULL
  END as billing_state,
  CASE 
    WHEN has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'sales'::app_role) 
    THEN billing_pincode
    ELSE NULL
  END as billing_pincode,
  CASE 
    WHEN has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'sales'::app_role) 
    THEN shipping_name
    ELSE NULL
  END as shipping_name,
  CASE 
    WHEN has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'sales'::app_role) 
    THEN shipping_email
    ELSE NULL
  END as shipping_email,
  CASE 
    WHEN has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'sales'::app_role) 
    THEN shipping_phone
    ELSE NULL
  END as shipping_phone,
  CASE 
    WHEN has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'sales'::app_role) 
    THEN shipping_address
    ELSE NULL
  END as shipping_address,
  CASE 
    WHEN has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'sales'::app_role) 
    THEN shipping_city
    ELSE NULL
  END as shipping_city,
  CASE 
    WHEN has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'sales'::app_role) 
    THEN shipping_state
    ELSE NULL
  END as shipping_state,
  CASE 
    WHEN has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'sales'::app_role) 
    THEN shipping_pincode
    ELSE NULL
  END as shipping_pincode,
  CASE 
    WHEN has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'sales'::app_role) 
    THEN order_total
    ELSE NULL
  END as order_total,
  CASE 
    WHEN has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'sales'::app_role) 
    THEN tax_cgst
    ELSE NULL
  END as tax_cgst,
  CASE 
    WHEN has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'sales'::app_role) 
    THEN tax_sgst
    ELSE NULL
  END as tax_sgst,
  woo_order_id,
  order_status,
  payment_status
FROM public.orders;

GRANT SELECT ON public.orders_secure TO authenticated;