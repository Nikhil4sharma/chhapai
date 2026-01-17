-- EMERGENCY FIX for "Creation Failed" error
-- The error "column total_spent is of type numeric but expression is of type text"
-- is caused by a trigger that tries to update total_spent with a text value.

-- 1. Drop the problematic trigger immediately
DROP TRIGGER IF EXISTS trigger_update_total_spent ON orders;

-- 2. Drop the function that the trigger calls
DROP FUNCTION IF EXISTS update_customer_total_spent();

-- 3. Just in case, grant execute to ensure no permission errors if we re-create it later (though we are dropping it)
-- (Skipped)
