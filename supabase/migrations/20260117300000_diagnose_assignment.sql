-- Diagnostic Query for Order Assignment (Simplified)
SELECT 
    id, 
    created_at,
    sales_agent_code, 
    assigned_user_email, 
    assigned_user
FROM public.orders
ORDER BY created_at DESC
LIMIT 5;
