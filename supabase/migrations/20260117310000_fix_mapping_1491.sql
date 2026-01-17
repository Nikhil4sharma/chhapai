-- Migration: Correct Sales Agent Mapping for 1491
-- Description: Updates mapping for 1491 to work@chhapai.in as per user request.

INSERT INTO public.sales_agent_mapping (sales_agent_code, user_email)
VALUES 
  ('1491', 'work@chhapai.in')
ON CONFLICT (sales_agent_code) 
DO UPDATE SET user_email = EXCLUDED.user_email;

-- Note: 3688 was also mapped to work@chhapai.in previously. We leave it as is unless corrected.
