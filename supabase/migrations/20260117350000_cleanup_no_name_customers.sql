-- Migration: Cleanup No Name Customers
-- Description: Deletes customers with no name who have NO orders. Renames those WITH orders to 'Unknown Customer'.

DO $$
DECLARE
  v_deleted_count int;
  v_updated_count int;
BEGIN
  -- 1. Delete customers with no name (empty first/last) AND no linked orders
  WITH deleted_rows AS (
    DELETE FROM wc_customers
    WHERE (first_name IS NULL OR TRIM(first_name) = '')
      AND (last_name IS NULL OR TRIM(last_name) = '')
      AND NOT EXISTS (SELECT 1 FROM orders WHERE orders.customer_id = wc_customers.id)
    RETURNING id
  )
  SELECT count(*) INTO v_deleted_count FROM deleted_rows;

  -- 2. Rename remaining no-name customers (who must have orders, otherwise would have been deleted above)
  WITH updated_rows AS (
    UPDATE wc_customers
    SET first_name = 'Unknown', last_name = 'Customer'
    WHERE (first_name IS NULL OR TRIM(first_name) = '')
      AND (last_name IS NULL OR TRIM(last_name) = '')
    RETURNING id
  )
  SELECT count(*) INTO v_updated_count FROM updated_rows;

  RAISE NOTICE 'Cleanup Complete: Deleted % unused customers. Renamed % customers with active orders.', v_deleted_count, v_updated_count;
END $$;
