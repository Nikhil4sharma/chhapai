-- Add payment tracking fields to orders and expose them via orders_secure view
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS amount_received numeric;

-- Recreate orders_secure view to include amount_received for admin/sales
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
  payment_status,
  -- Expose amount_received only for admin/sales
  CASE 
    WHEN has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'sales'::app_role) 
    THEN amount_received
    ELSE NULL
  END as amount_received
FROM public.orders;

GRANT SELECT ON public.orders_secure TO authenticated;


