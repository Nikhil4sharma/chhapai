-- Filter completed orders and implement email-based user assignment
-- This migration updates import_wc_order to skip completed orders and auto-assign users by email

CREATE OR REPLACE FUNCTION import_wc_order(payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_customer_id uuid;
  v_order_id uuid;
  v_assigned_user_id uuid;
  v_status text;
  v_order_status text;
  v_customer_name text;
BEGIN
  -- Extract variables
  v_status := payload->>'status'; -- WC status (processing, completed)
  
  -- 🚫 SKIP COMPLETED ORDERS
  -- Only import processing, pending, or on-hold orders
  IF v_status IN ('completed', 'cancelled', 'refunded', 'failed') THEN
    RAISE NOTICE 'Skipping order % with status %', payload->>'order_id', v_status;
    RETURN NULL; -- Return NULL to indicate skip
  END IF;
  
  -- 👤 EMAIL-BASED USER ASSIGNMENT
  -- Try to find assigned user by email from WooCommerce metadata
  IF payload->>'assigned_user_email' IS NOT NULL AND TRIM(payload->>'assigned_user_email') != '' THEN
    SELECT user_id INTO v_assigned_user_id
    FROM profiles
    WHERE LOWER(email) = LOWER(TRIM(payload->>'assigned_user_email'))
    LIMIT 1;
    
    IF v_assigned_user_id IS NOT NULL THEN
      RAISE NOTICE 'Assigned user found by email: %', payload->>'assigned_user_email';
    END IF;
  END IF;
  
  -- Fallback to payload assigned_user_id if email lookup fails
  IF v_assigned_user_id IS NULL THEN
    v_assigned_user_id := (payload->>'assigned_user_id')::uuid;
  END IF;
  
  -- Extract customer name with fallback logic
  -- Priority: 1. customer.name, 2. first_name + last_name, 3. 'Customer'
  v_customer_name := COALESCE(
    NULLIF(TRIM(payload->'customer'->>'name'), ''),
    CASE 
      WHEN NULLIF(TRIM(payload->'customer'->>'first_name'), '') IS NOT NULL 
      THEN TRIM(payload->'customer'->>'first_name') || ' ' || COALESCE(NULLIF(TRIM(payload->'customer'->>'last_name'), ''), '')
      ELSE NULL
    END,
    'Customer'
  );
  
  -- Determine order_status (internal workflow status)
  -- Only processing orders should reach here now
  v_order_status := COALESCE(
    payload->>'order_status',
    'new_order' -- processing, pending, on-hold -> new_order
  );

  -- 1️⃣ CUSTOMER UPSERT
  INSERT INTO wc_customers (wc_customer_id, first_name, last_name, email, phone, billing)
  VALUES (
    payload->'customer'->>'id',
    split_part(v_customer_name, ' ', 1),
    substr(v_customer_name, length(split_part(v_customer_name, ' ', 1)) + 2),
    payload->'customer'->>'email',
    payload->'customer'->>'phone',
    jsonb_build_object(
        'address_1', payload->'customer'->>'address',
        'first_name', split_part(v_customer_name, ' ', 1),
        'last_name', substr(v_customer_name, length(split_part(v_customer_name, ' ', 1)) + 2),
        'email', payload->'customer'->>'email',
        'phone', payload->'customer'->>'phone'
    )
  )
  ON CONFLICT (wc_customer_id)
  DO UPDATE SET
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    email = EXCLUDED.email,
    phone = EXCLUDED.phone,
    billing = EXCLUDED.billing
  RETURNING id INTO v_customer_id;

  -- 2️⃣ ORDER UPSERT
  INSERT INTO orders (
    wc_order_id,
    order_id,
    customer_id,
    customer_name,
    status,
    order_status,
    payment_status,
    total_amount,
    source,
    current_department,
    assigned_user,
    created_at,
    updated_at
  )
  VALUES (
    payload->>'order_id',
    payload->>'order_id',
    v_customer_id,
    v_customer_name,
    v_status,
    v_order_status,
    'pending',
    (payload->>'total')::numeric,
    'woocommerce',
    'sales',
    v_assigned_user_id,
    now(),
    now()
  )
  ON CONFLICT (wc_order_id)
  DO UPDATE SET
    customer_name = EXCLUDED.customer_name,
    status = EXCLUDED.status,
    order_status = EXCLUDED.order_status,
    total_amount = EXCLUDED.total_amount,
    assigned_user = COALESCE(EXCLUDED.assigned_user, orders.assigned_user),
    updated_at = now()
  RETURNING id INTO v_order_id;

  -- 3️⃣ CLEAR OLD ITEMS (for idempotency)
  DELETE FROM order_items WHERE order_id = v_order_id;

  -- 4️⃣ INSERT ITEMS
  INSERT INTO order_items (order_id, product_name, quantity, specifications, line_total, current_stage, status)
  SELECT
    v_order_id,
    item->>'name',
    (item->>'quantity')::int,
    item->'specs',
    (item->>'price')::numeric,
    'sales',
    v_order_status -- Sync item status with order status
  FROM jsonb_array_elements(payload->'items') AS item;

  RETURN v_order_id;
END;
$$;
