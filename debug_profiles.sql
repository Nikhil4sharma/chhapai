-- Check if Rohini's profile exists
SELECT id, email, full_name FROM profiles WHERE email = 'rohini@chhapai.in';

-- Check all sales agent mappings
SELECT * FROM sales_agent_mapping;

-- Check if the mapped users exist in profiles
SELECT 
    sam.sales_agent_code,
    sam.user_email,
    p.id as profile_id,
    p.full_name
FROM sales_agent_mapping sam
LEFT JOIN profiles p ON p.email = sam.user_email;
