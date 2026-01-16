-- FINAL COMPREHENSIVE FIX for WC Import
-- 1. Robust Agent Mapping (Nikhil, Rohini, Work)
-- 2. Force 'Pending' Payment Status
-- 3. Assign Customer to Agent
-- 4. Handle Total Amount robustness

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
  v_payment_status text;
  v_delivery_date timestamp;
  v_agent_name text;
  v_clean_agent_name text;
  v_meta_item jsonb;
  v_assigned_email text;
  v_total_amount numeric;
BEGIN
  -- Extract variables
  v_status := payload->>'status'; -- WC status (processing, completed)
  
  -- 🚫 SKIP COMPLETED ORDERS
  IF v_status IN ('completed', 'cancelled', 'refunded', 'failed') THEN
    RAISE NOTICE 'Skipping order % with status %', payload->>'order_id', v_status;
    RETURN NULL;
  END IF;
  
  -- 🕵️ AGENT MAPPING LOGIC (ROBUST)
  -- 1. Check top-level keys
  v_agent_name := COALESCE(payload->>'sales_agent', payload->>'agent');
  
  -- 2. If not found, check meta_data for common keys
  IF v_agent_name IS NULL AND payload->'meta_data' IS NOT NULL THEN
    FOR v_meta_item IN SELECT * FROM jsonb_array_elements(payload->'meta_data')
    LOOP
      IF v_meta_item->>'key' IN ('sales_agent', 'agent', 'ordered_by', '_sales_agent') THEN
        v_agent_name := v_meta_item->>'value';
        EXIT; -- Found it
      END IF;
    END LOOP;
  END IF;

  -- 3. Map Name to Email
  IF v_agent_name IS NOT NULL THEN
    -- Normalize: Lowercase and remove spaces
    v_clean_agent_name := LOWER(REPLACE(v_agent_name, ' ', ''));
    v_clean_agent_name := REPLACE(v_clean_agent_name, '.', ''); -- Remove dots too
    
    IF v_clean_agent_name IN ('nikhilsharma', 'nikhil', 'nikhil') THEN 
      v_assigned_email := 'chd+1@chhapai.in';
    ELSIF v_clean_agent_name IN ('rohiniraina', 'rohini', 'rohini') THEN 
      v_assigned_email := 'rohini@chhapai.in';
    ELSIF v_clean_agent_name IN ('work', 'workagent', 'office', 'jaskaran') THEN 
      v_assigned_email := 'work@chhapai.in';
    END IF;
  END IF;

  -- 4. Try to find user by mapped email OR payload email
  v_assigned_email := COALESCE(v_assigned_email, payload->>'assigned_user_email');
  
  IF v_assigned_email IS NOT NULL AND TRIM(v_assigned_email) != '' THEN
    SELECT user_id INTO v_assigned_user_id
    FROM profiles
    WHERE LOWER(email) = LOWER(TRIM(v_assigned_email))
    LIMIT 1;
    
    -- Log finding (visible in Postgres logs)
    IF v_assigned_user_id IS NOT NULL THEN
      RAISE NOTICE '✅ Auto-Assign: Found user % for email %', v_assigned_user_id, v_assigned_email;
    ELSE
      RAISE WARNING '⚠️ Auto-Assign: No user found for email %', v_assigned_email;
    END IF;
  END IF;
  
  -- 5. Fallback to payload assigned_user_id (Only if UUID)
  IF v_assigned_user_id IS NULL AND payload->>'assigned_user_id' IS NOT NULL THEN
    BEGIN
      v_assigned_user_id := (payload->>'assigned_user_id')::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      NULL;
    END;
  END IF;
  
  -- Customer Name Logic
  v_customer_name := COALESCE(
    NULLIF(TRIM(payload->'customer'->>'name'), ''),
    CASE 
      WHEN NULLIF(TRIM(payload->'customer'->>'first_name'), '') IS NOT NULL 
      THEN TRIM(payload->'customer'->>'first_name') || ' ' || COALESCE(NULLIF(TRIM(payload->'customer'->>'last_name'), ''), '')
      ELSE NULL
    END,
    'Customer'
  );
  
  -- 💰 PAYMENT STATUS LOGIC
  -- FORCE 'pending' as requested.
  v_payment_status := 'pending';
  
  -- Delivery Date Logic
  v_delivery_date := COALESCE(
    (payload->>'delivery_date')::timestamp,
    (payload->>'order_date')::timestamp + interval '7 days',
    now() + interval '7 days'
  );
  
  -- Order Status
  v_order_status := COALESCE(payload->>'order_status', 'new_order');
  
  -- Total Amount Logic with fallback
  v_total_amount := COALESCE((payload->>'total')::numeric, 0);

  -- 1️⃣ CUSTOMER UPSERT
  INSERT INTO wc_customers (
    wc_customer_id, 
    first_name, 
    last_name, 
    email, 
    phone, 
    billing,
    assigned_to -- Set assigned agent
  )
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
    ),
    v_assigned_user_id
  )
  ON CONFLICT (wc_customer_id)
  DO UPDATE SET
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    email = EXCLUDED.email,
    phone = EXCLUDED.phone,
    billing = EXCLUDED.billing,
    -- Update assignment ONLY if we found a valid agent for this order
    assigned_to = COALESCE(EXCLUDED.assigned_to, wc_customers.assigned_to)
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
    delivery_date,
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
    v_payment_status,
    v_delivery_date,
    v_total_amount,
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
    payment_status = EXCLUDED.payment_status,
    delivery_date = COALESCE(orders.delivery_date, EXCLUDED.delivery_date),
    total_amount = EXCLUDED.total_amount,
    assigned_user = COALESCE(EXCLUDED.assigned_user, orders.assigned_user),
    updated_at = now()
  RETURNING id INTO v_order_id;

  -- 3️⃣ CLEAR OLD ITEMS
  DELETE FROM order_items WHERE order_id = v_order_id;

  -- 4️⃣ INSERT ITEMS
  INSERT INTO order_items (order_id, product_name, quantity, specifications, line_total, current_stage, status, delivery_date)
  SELECT
    v_order_id,
    item->>'name',
    (item->>'quantity')::int,
    item->'specs',
    (item->>'price')::numeric,
    'sales',
    v_order_status,
    v_delivery_date
  FROM jsonb_array_elements(payload->'items') AS item;

  RETURN v_order_id;
END;
$$;
