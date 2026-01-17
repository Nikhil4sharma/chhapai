-- EMERGENCY LOGIC FIX: Bypass "No Unique Constraint" Error
-- Instead of relying on ON CONFLICT (which requires a unique constraint that might be failing due to dirty data),
-- we will use a "Manual Upsert" (UPDATE first, if not found then INSERT).
-- This ensures the function works regardless of unique constraint existence or duplicates.

-- =========================================================
-- 1. Redefine import_wc_order with Manual Upsert
-- =========================================================

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
  v_wc_customer_id_raw text;
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
  v_wc_customer_id_raw := COALESCE(payload->'customer'->>'id', 'manual-' || floor(extract(epoch from now())));
  
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

  -- 2️⃣ CUSTOMER MANUAL UPSERT (Update first, then Insert)
  -- Try to update existing customer by wc_customer_id
  UPDATE wc_customers 
  SET
    first_name = split_part(v_cust_name, ' ', 1),
    last_name = substr(v_cust_name, length(split_part(v_cust_name, ' ', 1)) + 2),
    email = v_cust_email,
    phone = v_cust_phone,
    assigned_manager = COALESCE(assigned_manager, v_assigned_user_id) -- Keep existing or set new
  WHERE wc_customer_id = v_wc_customer_id_raw
  RETURNING id INTO v_customer_id;

  -- If not found by ID, try to find by EMAIL (Healing Logic)
  IF v_customer_id IS NULL AND v_cust_email IS NOT NULL AND v_cust_email <> '' THEN
    UPDATE wc_customers
    SET
        wc_customer_id = v_wc_customer_id_raw, -- Heal the link
        first_name = split_part(v_cust_name, ' ', 1),
        last_name = substr(v_cust_name, length(split_part(v_cust_name, ' ', 1)) + 2),
        phone = COALESCE(phone, v_cust_phone),
        assigned_manager = COALESCE(assigned_manager, v_assigned_user_id)
    WHERE email = v_cust_email
    RETURNING id INTO v_customer_id;
  END IF;

  -- If still not found, insert new
  IF v_customer_id IS NULL THEN
    INSERT INTO wc_customers (wc_customer_id, first_name, last_name, email, phone, billing, assigned_manager)
    VALUES (
      v_wc_customer_id_raw,
      split_part(v_cust_name, ' ', 1),
      substr(v_cust_name, length(split_part(v_cust_name, ' ', 1)) + 2),
      v_cust_email,
      v_cust_phone,
      jsonb_build_object(
          'address_1', v_cust_address,
          'email', v_cust_email,
          'phone', v_cust_phone
      ),
      v_assigned_user_id
    )
    RETURNING id INTO v_customer_id;
  END IF;

  -- 3️⃣ ORDER MANUAL UPSERT (Update first, then Insert)
  -- Try to update existing order by wc_order_id
  UPDATE orders
  SET
    status = v_status,
    order_status = v_order_status,
    total_amount = COALESCE((payload->>'total')::numeric, 0),
    assigned_user = COALESCE(assigned_user, v_assigned_user_id), -- Keep existing or set new
    customer_name = v_cust_name,
    customer_email = v_cust_email,
    customer_phone = v_cust_phone,
    customer_id = v_customer_id, -- Ensure linked to correct customer
    updated_at = now()
  WHERE wc_order_id = v_wc_order_id_raw
  RETURNING id INTO v_order_id;

  -- If not found, insert new
  IF v_order_id IS NULL THEN
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
    RETURNING id INTO v_order_id;
  END IF;

  -- 4️⃣ CLEAR OLD ITEMS (Always re-sync items)
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

-- =========================================================
-- 2. Fix Security Definer View Warning
-- =========================================================

CREATE OR REPLACE VIEW customer_financial_summary
WITH (security_invoker = true)
AS
SELECT 
  wc.id,
  wc.email,
  wc.first_name,
  wc.last_name,
  wc.opening_balance as lifetime_spent,
  COALESCE(SUM(CASE WHEN pl.transaction_type = 'CREDIT' THEN pl.amount ELSE 0 END), 0) as total_paid,
  COALESCE(SUM(CASE 
    WHEN o.order_status NOT IN ('completed', 'cancelled', 'refunded') 
    THEN o.total_amount 
    ELSE 0 
  END), 0) as pending_orders_amount,
  (COALESCE(SUM(CASE WHEN pl.transaction_type = 'CREDIT' THEN pl.amount ELSE 0 END), 0) - 
   (wc.opening_balance + COALESCE(SUM(CASE 
     WHEN o.order_status NOT IN ('completed', 'cancelled', 'refunded') 
     THEN o.total_amount 
     ELSE 0 
   END), 0))) as balance,
  wc.orders_count,
  COUNT(CASE 
    WHEN o.order_status NOT IN ('completed', 'cancelled', 'refunded') 
    THEN 1 
  END) as pending_orders_count
FROM wc_customers wc
LEFT JOIN payment_ledger pl ON pl.customer_id = wc.id
LEFT JOIN orders o ON o.customer_id = wc.id
GROUP BY wc.id, wc.email, wc.first_name, wc.last_name, wc.opening_balance, wc.orders_count;

GRANT SELECT ON customer_financial_summary TO authenticated;
