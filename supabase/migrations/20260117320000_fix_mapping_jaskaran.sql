-- Migration: Update Mappings for 1491 and 3688
-- Description: Maps 1491 back to Rohini. Maps 3688 to Jaskaran (by looking up email).

DO $$
DECLARE
  v_jaskaran_email text;
BEGIN
  -- 1. Fix 1491 -> Rohini
  INSERT INTO public.sales_agent_mapping (sales_agent_code, user_email)
  VALUES ('1491', 'rohini@chhapai.in')
  ON CONFLICT (sales_agent_code) DO UPDATE SET user_email = EXCLUDED.user_email;

  -- 2. Find Jaskaran's email
  SELECT email INTO v_jaskaran_email 
  FROM public.profiles 
  WHERE full_name ILIKE '%Jaskaran%' 
  LIMIT 1;

  -- 3. Update 3688 if found
  IF v_jaskaran_email IS NOT NULL THEN
    INSERT INTO public.sales_agent_mapping (sales_agent_code, user_email)
    VALUES ('3688', v_jaskaran_email)
    ON CONFLICT (sales_agent_code) DO UPDATE SET user_email = EXCLUDED.user_email;
  ELSE
    RAISE WARNING 'User Jaskaran not found in profiles table. Mapping for 3688 not updated.';
  END IF;

END $$;
