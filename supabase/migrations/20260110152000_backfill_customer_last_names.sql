-- Backfill last_name for existing wc_customers from billing data
-- This extracts last_name from billing->last_name if available

UPDATE public.wc_customers
SET last_name = billing->>'last_name'
WHERE last_name IS NULL 
  AND billing IS NOT NULL 
  AND billing->>'last_name' IS NOT NULL
  AND billing->>'last_name' != '';
