
-- Debugging Rakhi Indsphinix Orders
-- Email: micro_pur01@indsphinx.com

-- 1. Check all customer records with this email
SELECT id, wc_id, email, first_name, last_name, orders_count 
FROM wc_customers 
WHERE email ILIKE 'micro_pur01@indsphinx.com';

-- 2. Check orders by email
SELECT id, order_id, customer_email, customer_id, total_amount, status, created_at
FROM orders 
WHERE customer_email ILIKE 'micro_pur01@indsphinx.com'
OR customer_name ILIKE '%Rakhi%';

-- 3. Check if any orders exist that ARE NOT linked to a customer record but should be
SELECT count(*) 
FROM orders 
WHERE customer_email = 'micro_pur01@indsphinx.com' 
AND customer_id IS NULL;
