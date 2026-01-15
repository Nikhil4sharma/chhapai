-- ==========================================
-- Fix import_wc_order Function - v3
-- Adds manager assignment to customer sync
-- ==========================================

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
  v_wc_order_id_raw text;
  -- Customer vars
  v_cust_name text;
  v_cust_email text;
  v_cust_phone text;
  v_cust_address text;
BEGIN
  -- 1. Validate Payload
  v_wc_order_id_raw := payload->>'order_id';
  
  IF v_wc_order_id_raw IS NULL OR v_wc_order_id_raw = '' THEN
    RAISE EXCEPTION 'Invalid Payload: order_id is missing or empty.';
  END IF;

  -- Extract variables
  v_assigned_user_id := (payload->>'assigned_user_id')::uuid;
  v_status := payload->>'status'; -- WC status
  
  -- Extract Customer Data
  v_cust_name := COALESCE(payload->'customer'->>'name', 'Guest');
  v_cust_email := payload->'customer'->>'email';
  v_cust_phone := payload->'customer'->>'phone';
  v_cust_address := payload->'customer'->>'address';
  
  -- Determine order_status
  v_order_status := COALESCE(
    payload->>'order_status',
    CASE 
      WHEN v_status = 'completed' THEN 'completed'
      WHEN v_status = 'cancelled' THEN 'cancelled'
      WHEN v_status = 'refunded' THEN 'cancelled'
      WHEN v_status = 'failed' THEN 'cancelled'
      ELSE 'new_order'
    END
  );

  -- 2️⃣ CUSTOMER UPSERT with Manager Assignment
  INSERT INTO wc_customers (wc_customer_id, first_name, last_name, email, phone, billing, assigned_manager)
  VALUES (
    COALESCE(payload->'customer'->>'id', 'manual-' || floor(extract(epoch from now()))), 
    split_part(v_cust_name, ' ', 1),
    substr(v_cust_name, length(split_part(v_cust_name, ' ', 1)) + 2),
    v_cust_email,
    v_cust_phone,
    jsonb_build_object(
        'address_1', v_cust_address,
        'email', v_cust_email,
        'phone', v_cust_phone
    ),
    v_assigned_user_id -- Assign the order manager to the customer
  )
  ON CONFLICT (wc_customer_id)
  DO UPDATE SET
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    email = EXCLUDED.email,
    phone = EXCLUDED.phone,
    -- Only update manager if currently null, OR always overwrite? 
    -- User logic: "manager bhi same assign ho jo order ka manager h" -> Implies overwrite or set.
    -- Let's set it to ensure sync.
    assigned_manager = COALESCE(EXCLUDED.assigned_manager, wc_customers.assigned_manager)
  RETURNING id INTO v_customer_id;

  -- 3️⃣ ORDER UPSERT
  INSERT INTO orders (
    wc_order_id,
    order_id,
    customer_id,
    status,
    order_status,
    payment_status,
    total_amount,
    source,
    current_department,
    assigned_user,
    created_at,
    updated_at,
    customer_name,
    customer_email,
    customer_phone,
    customer_address
  )
  VALUES (
    v_wc_order_id_raw,
    v_wc_order_id_raw,
    v_customer_id,
    v_status,
    v_order_status,
    'pending',
    COALESCE((payload->>'total')::numeric, 0),
    'woocommerce',
    'sales',
    v_assigned_user_id,
    now(),
    now(),
    v_cust_name,
    v_cust_email,
    v_cust_phone,
    v_cust_address
  )
  ON CONFLICT (wc_order_id)
  DO UPDATE SET
    status = EXCLUDED.status,
    order_status = EXCLUDED.order_status,
    total_amount = EXCLUDED.total_amount,
    assigned_user = COALESCE(EXCLUDED.assigned_user, orders.assigned_user),
    customer_name = EXCLUDED.customer_name,
    customer_email = EXCLUDED.customer_email,
    customer_phone = EXCLUDED.customer_phone,
    updated_at = now()
  RETURNING id INTO v_order_id;

  -- 4️⃣ CLEAR OLD ITEMS
  DELETE FROM order_items WHERE order_id = v_order_id;

  -- 5️⃣ INSERT ITEMS
  IF jsonb_array_length(payload->'items') > 0 THEN
      INSERT INTO order_items (order_id, product_name, quantity, specifications, line_total, current_stage, status)
      SELECT
        v_order_id,
        item->>'name',
        (item->>'quantity')::int,
        item->'specs',
        (item->>'price')::numeric,
        'sales',
        v_order_status
      FROM jsonb_array_elements(payload->'items') AS item;
  END IF;

  RETURN v_order_id;
END;
$$;
