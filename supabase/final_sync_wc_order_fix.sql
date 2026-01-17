
-- FINAL ROBUST sync_wc_order RPC
-- Fixes: Variable shadowing (wc_id), assignment loss, and CSV/WC merging conflicts.

CREATE OR REPLACE FUNCTION sync_wc_order(payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_customer_id uuid;
  v_order_id uuid;
  v_assigned_user_id uuid;
  v_assigned_email text;
  v_status text;
  v_order_status text DEFAULT 'new_order';
  v_customer_name text;
  v_payment_status text;
  v_delivery_date timestamp;
  v_agent_name text;
  v_clean_agent_code text;
  v_meta_item jsonb;
  v_total_amount numeric;
  v_order_number text;
  v_wc_order_id bigint;
  v_wc_customer_id bigint;
  v_is_paid boolean := false;
  v_payment_method text;
  v_transaction_type public.payment_transaction_type;
  v_customer_email text;
  v_existing_temp_id uuid;
  v_existing_assigned_to uuid;
BEGIN
  -- 1. Extract Basic Info
  v_wc_order_id := (payload->>'id')::bigint;
  v_order_number := payload->>'number';
  v_status := payload->>'status';
  v_payment_method := payload->>'payment_method';
  
  IF v_wc_order_id IS NULL THEN
     RAISE EXCEPTION 'WooCommerce Order ID is required';
  END IF;

  -- 2. Map WC status to Internal Status
  IF v_status = 'completed' THEN v_order_status := 'delivered';
  ELSIF v_status = 'processing' THEN v_order_status := 'production_in_progress';
  ELSIF v_status = 'on-hold' THEN v_order_status := 'design_in_progress';
  END IF;

  -- 3. Payment Status
  IF (payload->>'date_paid') IS NOT NULL AND (payload->>'date_paid') != '' THEN
     v_is_paid := true;
     v_payment_status := 'paid';
  ELSE
     v_payment_status := 'pending';
  END IF;

  -- 4. Customer Info
  v_customer_name := TRIM(COALESCE(
    NULLIF(TRIM(payload->'billing'->>'first_name') || ' ' || TRIM(payload->'billing'->>'last_name'), ''),
    NULLIF(TRIM(payload->'shipping'->>'first_name') || ' ' || TRIM(payload->'shipping'->>'last_name'), ''),
    'Guest Customer'
  ));
  v_customer_email := payload->'billing'->>'email';

  -- 5. Delivery Date
  v_delivery_date := COALESCE((payload->>'date_created')::timestamp + interval '7 days', now() + interval '7 days');

  -- 6. Total
  v_total_amount := COALESCE((payload->>'total')::numeric, 0);

  -- 7. Agent Mapping (from payload meta)
  IF payload->'meta_data' IS NOT NULL THEN
    FOR v_meta_item IN SELECT * FROM jsonb_array_elements(payload->'meta_data')
    LOOP
       IF (
           LOWER(v_meta_item->>'key') IN ('sales_agent', 'agent', 'ordered_by', '_sales_agent', 'sales_person', 'whatsapp_agent') 
           OR (LOWER(v_meta_item->>'key') LIKE '%agent%' AND LOWER(v_meta_item->>'key') NOT LIKE '%user_agent%')
           OR (LOWER(v_meta_item->>'key') LIKE '%sales%' AND LOWER(v_meta_item->>'key') NOT LIKE '%total_sales%' AND LOWER(v_meta_item->>'key') NOT LIKE '%tax%')
       ) THEN
          v_agent_name := v_meta_item->>'value';
          v_clean_agent_code := LOWER(REPLACE(REPLACE(v_agent_name, ' ', ''), '.', ''));
          EXIT;
       END IF;
    END LOOP;
  END IF;

  IF v_clean_agent_code IS NOT NULL THEN
      SELECT user_email INTO v_assigned_email FROM public.sales_agent_mapping WHERE sales_agent_code = v_clean_agent_code LIMIT 1;
      IF v_assigned_email IS NOT NULL THEN
          SELECT id INTO v_assigned_user_id FROM auth.users WHERE email = v_assigned_email LIMIT 1;
          IF v_assigned_user_id IS NULL THEN
              SELECT user_id INTO v_assigned_user_id FROM public.profiles WHERE email = v_assigned_email LIMIT 1;
          END IF;
      END IF;
  END IF;

  -- C. Final Fallback: Use providing user from payload (for manual sync tracking)
  IF v_assigned_user_id IS NULL AND payload->>'_current_user_id' IS NOT NULL THEN
      v_assigned_user_id := (payload->>'_current_user_id')::uuid;
  END IF;

  -- 8. UPSERT CUSTOMER (Priority: wc_id > email)
  v_wc_customer_id := (payload->>'customer_id')::bigint;

  -- Strategy: Check for existing by wc_id first, then email
  IF v_wc_customer_id > 0 THEN
      -- Existing registered customer?
      SELECT id, assigned_to INTO v_customer_id, v_existing_assigned_to FROM wc_customers WHERE wc_id = v_wc_customer_id LIMIT 1;
      
      -- If not found by wc_id, try email (might be a CSV record)
      IF v_customer_id IS NULL AND v_customer_email IS NOT NULL THEN
          SELECT id, assigned_to INTO v_customer_id, v_existing_assigned_to FROM wc_customers WHERE email = v_customer_email LIMIT 1;
          
          IF v_customer_id IS NOT NULL THEN
              -- HEAL: Merge CSV record into WC record
              UPDATE wc_customers SET wc_id = v_wc_customer_id, updated_at = now() WHERE id = v_customer_id;
          END IF;
      END IF;
  ELSE
      -- Guest (wc_id = 0) - find by email
      IF v_customer_email IS NOT NULL THEN
          SELECT id, assigned_to INTO v_customer_id, v_existing_assigned_to FROM wc_customers WHERE email = v_customer_email LIMIT 1;
      END IF;
  END IF;

  -- Final Upsert/Insert
  IF v_customer_id IS NOT NULL THEN
      UPDATE wc_customers SET
        email = COALESCE(v_customer_email, email),
        first_name = COALESCE(payload->'billing'->>'first_name', first_name),
        last_name = COALESCE(payload->'billing'->>'last_name', last_name),
        phone = COALESCE(payload->'billing'->>'phone', phone),
        billing = COALESCE(payload->'billing', billing),
        shipping = COALESCE(payload->'shipping', shipping),
        assigned_to = COALESCE(assigned_to, v_assigned_user_id), -- Preserve existing if present
        updated_at = now()
      WHERE id = v_customer_id;
  ELSE
      INSERT INTO wc_customers (wc_id, email, first_name, last_name, phone, billing, shipping, assigned_to, source, updated_at)
      VALUES (
        COALESCE(v_wc_customer_id, 0), v_customer_email, payload->'billing'->>'first_name', payload->'billing'->>'last_name',
        payload->'billing'->>'phone', payload->'billing', payload->'shipping', v_assigned_user_id, 'woocommerce', now()
      )
      RETURNING id INTO v_customer_id;
  END IF;

  -- 9. UPSERT ORDER
  INSERT INTO orders (
    wc_order_id, wc_order_number, customer_id, customer_name, 
    status, order_status, payment_status, total_amount, order_total, currency,
    delivery_date, assigned_user, assigned_user_email, sales_agent_code,
    current_department, source, raw_wc_payload, updated_at
  )
  VALUES (
    v_wc_order_id, v_order_number, v_customer_id, v_customer_name,
    v_status, v_order_status, v_payment_status, v_total_amount, v_total_amount,
    COALESCE(payload->>'currency', 'INR'), v_delivery_date, 
    COALESCE(v_assigned_user_id, v_existing_assigned_to), -- Use agent or existing customer assignment
    v_assigned_email, v_clean_agent_code, 'sales', 'woocommerce', payload, now()
  )
  ON CONFLICT (wc_order_id) DO UPDATE SET
    status = EXCLUDED.status,
    order_status = EXCLUDED.order_status,
    payment_status = EXCLUDED.payment_status,
    total_amount = EXCLUDED.total_amount,
    raw_wc_payload = EXCLUDED.raw_wc_payload,
    customer_id = EXCLUDED.customer_id,
    updated_at = now()
  RETURNING id INTO v_order_id;

  -- 10. UPSERT ITEMS
  DELETE FROM order_items WHERE order_id = v_order_id;
  INSERT INTO order_items (order_id, product_name, quantity, line_total, current_stage, status, delivery_date)
  SELECT v_order_id, item->>'name', (item->>'quantity')::int, (item->>'total')::numeric, 'sales', v_order_status, v_delivery_date
  FROM jsonb_array_elements(payload->'line_items') AS item;

  -- 11. LEDGER ENTRY
  IF v_is_paid THEN v_transaction_type := 'CREDIT'; ELSE v_transaction_type := 'DEBIT'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.payment_ledger WHERE order_id = v_order_id AND transaction_type = v_transaction_type) THEN
      INSERT INTO public.payment_ledger (customer_id, order_id, amount, transaction_type, payment_method, created_by)
      VALUES (v_customer_id, v_order_id, v_total_amount, v_transaction_type, v_payment_method, NULL);
  END IF;

  RETURN v_order_id;
END;
$$;
