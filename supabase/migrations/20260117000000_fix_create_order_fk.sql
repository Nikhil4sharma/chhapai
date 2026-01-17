-- Fix Create Order FK Violation
-- Ensure that import_wc_order checks against public.profiles before assigning
-- Base: 20260116180000_robust_auto_assign_v2.sql

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

  -- 5. Match Agent to User ID
  IF v_agent_name IS NOT NULL THEN
    -- Normalize: Lowercase, remove spaces, remove dots
    v_clean_agent_name := LOWER(REPLACE(REPLACE(v_agent_name, ' ', ''), '.', ''));
    
    -- A. Hardcoded Overrides
    IF v_clean_agent_name IN ('nikhilsharma', 'nikhil') THEN 
      v_assigned_email := 'chd+1@chhapai.in';
    ELSIF v_clean_agent_name IN ('rohiniraina', 'rohini') THEN 
      v_assigned_email := 'rohini@chhapai.in';
    ELSIF v_clean_agent_name IN ('work', 'workagent', 'office', 'jaskaran') THEN 
      v_assigned_email := 'work@chhapai.in';
    END IF;

    -- B. Lookup by Email
    v_assigned_email := COALESCE(v_assigned_email, payload->>'assigned_user_email');
    IF v_assigned_email IS NOT NULL AND TRIM(v_assigned_email) != '' THEN
        SELECT user_id INTO v_assigned_user_id
        FROM profiles
        WHERE LOWER(email) = LOWER(TRIM(v_assigned_email))
        LIMIT 1;
    END IF;

    -- C. Lookup by Name (Dynamic)
    IF v_assigned_user_id IS NULL AND v_clean_agent_name IS NOT NULL THEN
        SELECT user_id INTO v_assigned_user_id
        FROM profiles
        WHERE LOWER(REPLACE(REPLACE(full_name, ' ', ''), '.', '')) = v_clean_agent_name
        OR LOWER(REPLACE(full_name, ' ', '')) LIKE v_clean_agent_name || '%'
        LIMIT 1;
    END IF;
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
    SELECT user_id INTO v_assigned_user_id
    FROM user_roles
    WHERE role = 'sales'
    LIMIT 1;
  END IF;
  
  -- 🛡️ 8. SAFEGUARD: Ensure Assigned User Exists in Public Profiles
  -- Fix for FK Violation: wc_customers_assigned_to_fkey
  IF v_assigned_user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_assigned_user_id) THEN
      RAISE WARNING 'Assigned User ID % not found in profiles. Defaulting to NULL.', v_assigned_user_id;
      v_assigned_user_id := NULL;
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
  
  -- Delivery Date Logic
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
    assigned_to = COALESCE(EXCLUDED.assigned_to, wc_customers.assigned_to)
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
    v_order_status,
    v_delivery_date
  FROM jsonb_array_elements(payload->'items') AS item;

  RETURN v_order_id;
END;
$$;
