
-- Debugging Rakhi Indsphinix disappearance
-- Email: micro_pur01@indsphinx.com

-- 1. Check all records with this email (including deleted if there was soft delete, but we don't have it)
SELECT id, wc_id, email, first_name, last_name, assigned_to, source, created_at, updated_at
FROM wc_customers 
WHERE email ILIKE 'micro_pur01@indsphinx.com'
OR first_name ILIKE '%Rakhi%'
OR last_name ILIKE '%Rakhi%';

-- 2. Check if there are orders for this email that are unlinked
SELECT id, wc_order_number, customer_email, customer_id, customer_name
FROM orders 
WHERE customer_email ILIKE 'micro_pur01@indsphinx.com';
