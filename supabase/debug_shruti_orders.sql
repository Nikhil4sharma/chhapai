-- Simple Diagnostic: Check Shruti's Data
-- Run each query separately in Supabase SQL Editor

-- Query 1: Find Shruti's customer record
SELECT * FROM wc_customers WHERE email = 'shruti@biesca.in';

-- Query 2: Check her orders (use customer ID from Query 1)
SELECT * FROM orders WHERE customer_id = (SELECT id FROM wc_customers WHERE email = 'shruti@biesca.in');

-- Query 3: Count orders
SELECT COUNT(*) as order_count FROM orders WHERE customer_id = (SELECT id FROM wc_customers WHERE email = 'shruti@biesca.in');
