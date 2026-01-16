-- Fetch latest 3 debug payloads to inspect WC structure
SELECT id, created_at, payload 
FROM public.debug_payloads 
ORDER BY created_at DESC 
LIMIT 3;
