-- Migration: Add Sales Agent Mappings
-- Description: Inserts mappings for Sales Agent Codes to User Emails to enable auto-assignment.

INSERT INTO public.sales_agent_mapping (sales_agent_code, user_email)
VALUES 
  ('1491', 'rohini@chhapai.in'),
  ('3688', 'work@chhapai.in'), -- Re-affirming
  ('salesmanager', 'chd+1@chhapai.in'), -- Fallback for semantic name
  ('nikhilsharma', 'chd+1@chhapai.in')  -- Fallback for name-based
ON CONFLICT (sales_agent_code) 
DO UPDATE SET user_email = EXCLUDED.user_email;
