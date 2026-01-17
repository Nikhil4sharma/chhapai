-- Add missing agent mapping for 3688 -> Rohini
INSERT INTO public.sales_agent_mapping (sales_agent_code, user_email)
VALUES ('3688', 'rohini@chhapai.in')
ON CONFLICT (sales_agent_code) 
DO UPDATE SET user_email = EXCLUDED.user_email;
