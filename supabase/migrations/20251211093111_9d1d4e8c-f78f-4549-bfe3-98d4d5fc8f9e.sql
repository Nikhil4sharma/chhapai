-- Create a secure view for profiles that masks phone for non-admin users
CREATE VIEW public.profiles_secure
WITH (security_invoker = true)
AS
SELECT 
  id,
  user_id,
  full_name,
  avatar_url,
  department,
  -- Only admins can see phone numbers
  CASE 
    WHEN has_role(auth.uid(), 'admin') 
    THEN phone 
    ELSE NULL 
  END AS phone,
  created_at,
  updated_at
FROM public.profiles;