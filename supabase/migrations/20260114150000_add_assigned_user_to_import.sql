-- Add assigned_user support to import_wc_order RPC
-- This migration ensures assigned_user field exists and updates the RPC function

-- 1. Ensure orders.assigned_user column exists (should already exist, but safe check)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'assigned_user'
    ) THEN
        ALTER TABLE orders ADD COLUMN assigned_user uuid REFERENCES auth.users(id);
        CREATE INDEX IF NOT EXISTS idx_orders_assigned_user ON orders(assigned_user);
    END IF;
END $$;

-- 2. Update import_wc_order RPC to support assigned_user
CREATE OR REPLACE FUNCTION import_wc_order(payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_customer_id uuid;
  v_order_id uuid;
  v_assigned_user_id uuid;
BEGIN
  -- Extract assigned_user from payload (optional)
  v_assigned_user_id := (payload->>'assigned_user_id')::uuid;

  -- 1️⃣ CUSTOMER UPSERT
  INSERT INTO wc_customers (wc_customer_id, first_name, last_name, email, phone, billing)
  VALUES (
    payload->'customer'->>'id',
    split_part(payload->'customer'->>'name', ' ', 1), -- First name
    substr(payload->'customer'->>'name', length(split_part(payload->'customer'->>'name', ' ', 1)) + 2), -- Last name
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
    payload->>'status',
    'new_order',
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
    total_amount = EXCLUDED.total_amount,
    assigned_user = COALESCE(EXCLUDED.assigned_user, orders.assigned_user),
    updated_at = now()
  RETURNING id INTO v_order_id;

  -- 3️⃣ CLEAR OLD ITEMS (for idempotency/updates)
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
    'new_order'
  FROM jsonb_array_elements(payload->'items') AS item;

  RETURN v_order_id;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION import_wc_order TO authenticated;
