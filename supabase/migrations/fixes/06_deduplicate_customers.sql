-- Start transaction to ensure data integrity
BEGIN;

-- 1. Create a temporary table to identify duplicates and decide which ID to keep
CREATE TEMP TABLE customer_dedup AS
SELECT
    id,
    email,
    wc_id,
    ROW_NUMBER() OVER (PARTITION BY lower(email) ORDER BY wc_id DESC, created_at DESC) as rank
FROM
    wc_customers
WHERE
    email IS NOT NULL AND email != '';

-- Keep the one with rank 1 (latest/highest wc_id), mark others for deletion
-- We need to map old_id -> new_id
CREATE TEMP TABLE customer_mapping AS
SELECT
    d.id as old_id,
    k.id as new_id
FROM
    customer_dedup d
JOIN
    customer_dedup k ON lower(d.email) = lower(k.email) AND k.rank = 1
WHERE
    d.rank > 1;

-- 2. Update REFERENCES in foreign key tables to point to the 'kept' customer

-- 2a. Update 'orders' table
UPDATE orders
SET customer_id = m.new_id
FROM customer_mapping m
WHERE orders.customer_id = m.old_id;

-- 2b. Update 'payment_ledger' table
UPDATE payment_ledger
SET customer_id = m.new_id
FROM customer_mapping m
WHERE payment_ledger.customer_id = m.old_id;

-- 2c. Update 'wc_customers' table: if any internal relationships existed (unlikely but safe)
-- (Skipping as no self-ref)

-- 3. Delete the duplicate customers
DELETE FROM wc_customers
WHERE id IN (SELECT old_id FROM customer_mapping);

-- 4. Add UNIQUE Constraint to email to prevent future duplicates
-- Using CREATE UNIQUE INDEX ... which is equivalent to CONSTRAINT but allows 'IF NOT EXISTS' logic flexibly
-- However, standard way:
ALTER TABLE wc_customers DROP CONSTRAINT IF EXISTS wc_customers_email_key;
ALTER TABLE wc_customers ADD CONSTRAINT wc_customers_email_key UNIQUE (email);

COMMIT;
