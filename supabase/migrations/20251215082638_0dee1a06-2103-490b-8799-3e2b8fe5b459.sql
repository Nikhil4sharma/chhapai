-- Fix security definer view warnings by using security_invoker = true
-- This makes the views use the permissions of the calling user

-- Recreate orders_secure view with security invoker
DROP VIEW IF EXISTS public.orders_secure;

CREATE VIEW public.orders_secure 
WITH (security_invoker = true)
AS
SELECT 
  id,
  order_id,
  customer_name,
  -- Mask sensitive customer data for non-sales/admin
  CASE 
    WHEN has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'sales') THEN customer_email
    ELSE NULL
  END as customer_email,
  CASE 
    WHEN has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'sales') THEN customer_phone
    ELSE NULL
  END as customer_phone,
  CASE 
    WHEN has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'sales') THEN customer_address
    ELSE NULL
  END as customer_address,
  delivery_date,
  global_notes,
  priority,
  source,
  is_completed,
  created_by,
  created_at,
  updated_at
FROM public.orders;

-- Recreate profiles_secure view with security invoker
DROP VIEW IF EXISTS public.profiles_secure;

CREATE VIEW public.profiles_secure 
WITH (security_invoker = true)
AS
SELECT 
  id,
  user_id,
  full_name,
  avatar_url,
  department,
  -- Mask phone for non-admin users (they can see their own)
  CASE 
    WHEN has_role(auth.uid(), 'admin') OR user_id = auth.uid() THEN phone
    ELSE NULL
  END as phone,
  created_at,
  updated_at
FROM public.profiles;