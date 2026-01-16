-- Migration to fix Agent Mapping using Hardcoded UUIDs (since emails are null in profiles)
-- Also enforces strict customer assignment.

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
  v_total_amount numeric;
BEGIN
  -- 1. 🐛 DEBUG LOGGING
  INSERT INTO public.debug_payloads (payload) VALUES (payload);

  -- 2. Extract Variables
  v_status := payload->>'status'; 
  
  -- 3. 🚫 SKIP COMPLETED ORDERS
  IF v_status IN ('completed', 'cancelled', 'refunded', 'failed') THEN
    RETURN NULL;
  END IF;
  
  -- 4. 🕵️ AGENT MAPPING LOGIC (EXHAUSTIVE)
  -- A. Check top-level keys
  v_agent_name := COALESCE(
    payload->>'sales_agent', 
    payload->>'agent',
    payload->>'seller_id',
    payload->>'customer_user',
    payload->>'_sales_agent'
  );
  
  -- B. Check meta_data array for common keys
  IF v_agent_name IS NULL AND payload->'meta_data' IS NOT NULL THEN
    FOR v_meta_item IN SELECT * FROM jsonb_array_elements(payload->'meta_data')
    LOOP
      IF LOWER(v_meta_item->>'key') IN ('sales_agent', 'agent', 'ordered_by', '_sales_agent', 'sales_person', 'whatsapp_agent') THEN
        v_agent_name := v_meta_item->>'value';
        EXIT; 
      END IF;
    END LOOP;
  END IF;

  -- 5. Match Agent to User ID (Hardcoded UUIDs based on Profile Debug)
  IF v_agent_name IS NOT NULL THEN
    -- Normalize: Lowercase, remove spaces, remove dots
    v_clean_agent_name := LOWER(REPLACE(REPLACE(v_agent_name, ' ', ''), '.', ''));
    
    CASE 
      -- NIKHIL
      WHEN v_clean_agent_name IN ('nikhilsharma', 'nikhil', 'admin') THEN 
        v_assigned_user_id := 'f25cbfb1-ee46-4376-8411-7af000ea356f'::uuid;
        
      -- ROHINI
      WHEN v_clean_agent_name IN ('rohiniraina', 'rohini', 'rs') THEN 
        v_assigned_user_id := 'b57d744b-61cd-4dbc-8680-2c06ac28148e'::uuid;
        
      -- WORK / JASKARAN
      WHEN v_clean_agent_name IN ('work', 'workagent', 'office', 'jaskaran', 'jaskaransingh') THEN 
        v_assigned_user_id := '218f243b-1522-45f8-8b96-98bcedcda45f'::uuid;
        
      ELSE
         -- Try Name Match if no direct match
         SELECT id INTO v_assigned_user_id
         FROM profiles
         WHERE LOWER(REPLACE(REPLACE(full_name, ' ', ''), '.', '')) = v_clean_agent_name
         OR LOWER(REPLACE(full_name, ' ', '')) LIKE v_clean_agent_name || '%'
         LIMIT 1;
    END CASE;
  END IF;

  -- 6. Fallback to payload assigned_user_id (if UUID)
  IF v_assigned_user_id IS NULL AND payload->>'assigned_user_id' IS NOT NULL THEN
    BEGIN
      v_assigned_user_id := (payload->>'assigned_user_id')::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      NULL;
    END;
  END IF;

  -- 🆕 7. ULTIMATE FALLBACK: Assign to FIRST Sales User
  IF v_assigned_user_id IS NULL THEN
     -- Log warning
     INSERT INTO public.debug_payloads (payload) VALUES (jsonb_build_object('error', 'Agent Assignment Failed', 'agent_name', v_agent_name, 'raw_payload', payload));
     
    SELECT user_id INTO v_assigned_user_id
    FROM user_roles
    WHERE role = 'sales'
    LIMIT 1;
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
  
  -- Force Pending Status
  v_payment_status := 'pending';
  
  -- Delivery Date
  v_delivery_date := COALESCE(
    (payload->>'delivery_date')::timestamp,
    (payload->>'order_date')::timestamp + interval '7 days',
    now() + interval '7 days'
  );
  
  -- Order Total
  v_total_amount := COALESCE(
      (payload->>'total')::numeric, 
      (payload->>'total_amount')::numeric,
      (payload->>'order_total')::numeric,
      0
  );

  -- 1️⃣ CUSTOMER UPSERT
  INSERT INTO wc_customers (
    wc_customer_id, first_name, last_name, email, phone, billing, assigned_to
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
    -- 🛑 CRITICAL: Always update assignment
    assigned_to = v_assigned_user_id
  RETURNING id INTO v_customer_id;

  -- 2️⃣ ORDER UPSERT
  INSERT INTO orders (
    wc_order_id, order_id, customer_id, customer_name, status, order_status, payment_status, delivery_date, total_amount, source, current_department, assigned_user, created_at, updated_at
  )
  VALUES (
    payload->>'order_id',
    payload->>'order_id',
    v_customer_id,
    v_customer_name,
    v_status,
    COALESCE(payload->>'order_status', 'new_order'),
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

  -- 3️⃣ ITEMS
  DELETE FROM order_items WHERE order_id = v_order_id;

  INSERT INTO order_items (order_id, product_name, quantity, specifications, line_total, current_stage, status, delivery_date)
  SELECT
    v_order_id,
    item->>'name',
    (item->>'quantity')::int,
    item->'specs',
    (item->>'price')::numeric,
    'sales',
    COALESCE(payload->>'order_status', 'new_order'),
    v_delivery_date
  FROM jsonb_array_elements(payload->'items') AS item;

  RETURN v_order_id;
END;
$$;
