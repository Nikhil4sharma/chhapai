-- Fix import_wc_order status mapping
-- This migration updates the RPC to respect order_status from payload

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
BEGIN
  -- Extract variables
  v_assigned_user_id := (payload->>'assigned_user_id')::uuid;
  v_status := payload->>'status'; -- WC status (processing, completed)
  
  -- Determine order_status (internal workflow status)
  -- If payload provides order_status, use it. Otherwise default based on WC status.
  v_order_status := COALESCE(
    payload->>'order_status',
    CASE 
      WHEN v_status = 'completed' THEN 'completed'
      WHEN v_status = 'cancelled' THEN 'cancelled'
      WHEN v_status = 'refunded' THEN 'cancelled'
      WHEN v_status = 'failed' THEN 'cancelled'
      ELSE 'new_order' -- processing, pending, on-hold -> new_order
    END
  );

  -- 1️⃣ CUSTOMER UPSERT
  INSERT INTO wc_customers (wc_customer_id, first_name, last_name, email, phone, billing)
  VALUES (
    payload->'customer'->>'id',
    split_part(payload->'customer'->>'name', ' ', 1),
    substr(payload->'customer'->>'name', length(split_part(payload->'customer'->>'name', ' ', 1)) + 2),
    payload->'customer'->>'email',
    payload->'customer'->>'phone',
    jsonb_build_object(
        'address_1', payload->'customer'->>'address',
        'first_name', split_part(payload->'customer'->>'name', ' ', 1),
        'last_name', substr(payload->'customer'->>'name', length(split_part(payload->'customer'->>'name', ' ', 1)) + 2),
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
    status = EXCLUDED.status,
    order_status = EXCLUDED.order_status, -- Allow status updates
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
