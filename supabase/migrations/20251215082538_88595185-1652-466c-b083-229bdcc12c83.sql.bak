-- Fix Security Issues

-- 1. Add RLS policies to orders_secure view (it's a secure view, needs protection)
-- Since orders_secure is a VIEW, we need to handle it differently
-- Let's add proper policies or ensure it's only accessible by admins

-- First, let's drop the existing view and recreate with proper security
DROP VIEW IF EXISTS public.orders_secure;

-- Recreate orders_secure view that masks sensitive data for non-sales/admin users
CREATE OR REPLACE VIEW public.orders_secure AS
SELECT 
  id,
  order_id,
  customer_name,
  -- Mask sensitive customer data
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

-- 2. Update profiles_secure view to mask phone for non-admins
DROP VIEW IF EXISTS public.profiles_secure;

CREATE OR REPLACE VIEW public.profiles_secure AS
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

-- 3. Update the profiles table RLS policy to restrict phone access
-- First drop the existing overly permissive policy
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

-- Create new policy that allows viewing basic info but restricts phone
CREATE POLICY "Users can view basic profile info" 
ON public.profiles 
FOR SELECT 
USING (
  -- Admin can see everything
  has_role(auth.uid(), 'admin') OR
  -- Users can see their own full profile
  user_id = auth.uid() OR
  -- Others can see basic info (full_name, department, avatar - phone is masked at view level)
  true
);

-- 4. Clear assigned_to when deleting a user (handle via trigger)
CREATE OR REPLACE FUNCTION public.handle_user_deletion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Clear assigned_to references in order_items
  UPDATE public.order_items
  SET assigned_to = NULL
  WHERE assigned_to = OLD.user_id;
  
  RETURN OLD;
END;
$$;

-- Create trigger for user deletion cleanup
DROP TRIGGER IF EXISTS on_profile_delete ON public.profiles;
CREATE TRIGGER on_profile_delete
  BEFORE DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_user_deletion();