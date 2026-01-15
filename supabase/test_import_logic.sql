DO $$
DECLARE
    v_order_id uuid;
    v_customer_id uuid;
    v_assigned_manager uuid;
    v_test_user_id uuid;
BEGIN
    -- 1. Get a REAL user ID from the database to satisfy Foreign Key constraint
    SELECT id INTO v_test_user_id FROM auth.users LIMIT 1;

    IF v_test_user_id IS NULL THEN
        RAISE EXCEPTION 'No users found in auth.users to test with!';
    END IF;

    RAISE NOTICE 'Testing with User ID: %', v_test_user_id;

    -- 2. Call the function with a dummy payload but VALID user ID
    v_order_id := import_wc_order(jsonb_build_object(
        'order_id', 'TEST-ORDER-002', -- Changed ID to avoid conflict if previous partial run succeeded
        'status', 'processing',
        'total', 2500,
        'assigned_user_id', v_test_user_id,
        'customer', jsonb_build_object(
            'id', 'TEST-CUST-002',
            'name', 'Test Customer Two',
            'email', 'test2@example.com',
            'phone', '9876543210',
            'address', 'Test Address 2'
        ),
        'items', jsonb_build_array()
    ));

    -- 3. Verify the customer was created/updated assigns
    SELECT id, assigned_manager INTO v_customer_id, v_assigned_manager
    FROM wc_customers 
    WHERE wc_customer_id = 'TEST-CUST-002';

    RAISE NOTICE 'Order ID: %', v_order_id;
    RAISE NOTICE 'Customer ID: %', v_customer_id;
    RAISE NOTICE 'Assigned Manager: %', v_assigned_manager;

    IF v_assigned_manager = v_test_user_id THEN
        RAISE NOTICE 'SUCCESS: Manager correctly assigned matching the Order Manager.';
    ELSE
        RAISE NOTICE 'FAILURE: Manager NOT assigned. Expected %, Got %', v_test_user_id, v_assigned_manager;
    END IF;

    -- Cleanup (Rollback effectively)
    DELETE FROM order_items WHERE order_id = v_order_id;
    DELETE FROM orders WHERE id = v_order_id;
    DELETE FROM wc_customers WHERE id = v_customer_id;

END $$;
