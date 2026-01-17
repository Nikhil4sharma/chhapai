
-- SCHEMA FIX V3: Ensures all necessary columns exist and RPC is robust
-- Matches requirements for: customer_email, customer_phone, wc_order_number

DO $$ 
BEGIN
    -- 1. Ensure orders table has all linking columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'customer_email') THEN
        ALTER TABLE orders ADD COLUMN customer_email TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'customer_phone') THEN
        ALTER TABLE orders ADD COLUMN customer_phone TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'wc_order_number') THEN
        ALTER TABLE orders ADD COLUMN wc_order_number TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'wc_order_id') THEN
        ALTER TABLE orders ADD COLUMN wc_order_id TEXT;
    END IF;

    -- Ensure types are correct
    ALTER TABLE orders ALTER COLUMN wc_order_id TYPE TEXT;
    ALTER TABLE orders ALTER COLUMN wc_order_number TYPE TEXT;

    -- 2. FK FIX: Ensure wc_customers.assigned_to references auth.users(id)
    -- This fixes the visibility mismatch where profiles.id was being used instead of auth.users.id
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'wc_customers_assigned_to_fkey' 
        AND table_name = 'wc_customers'
    ) THEN
        ALTER TABLE wc_customers DROP CONSTRAINT wc_customers_assigned_to_fkey;
    END IF;

    ALTER TABLE wc_customers 
    ADD CONSTRAINT wc_customers_assigned_to_fkey 
    FOREIGN KEY (assigned_to) 
    REFERENCES auth.users(id) 
    ON DELETE SET NULL;

    -- 3. NOTIFICATIONS FIX: Ensure customer_id exists (Fixes Payment Ledger Error)
    -- The table might exist from a previous migration without these columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'customer_id') THEN
        ALTER TABLE notifications ADD COLUMN customer_id UUID REFERENCES wc_customers(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'order_id') THEN
        ALTER TABLE notifications ADD COLUMN order_id UUID REFERENCES orders(id) ON DELETE CASCADE;
    END IF;

END $$;

-- 2. Robust sync_wc_order RPC (V3)
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
  v_customer_email text;
  v_customer_phone text;
  v_payment_status text;
  v_delivery_date timestamp;
  v_agent_name text;
  v_clean_agent_code text;
  v_meta_item jsonb;
  v_total_amount numeric;
  v_order_number text;
  v_wc_order_id text;
  v_wc_customer_id bigint;
  v_is_paid boolean := false;
  v_payment_method text;
  v_transaction_type public.payment_transaction_type;
  v_existing_assigned_to uuid;
BEGIN
  -- 1. Extract Basic Info
  v_wc_order_id := payload->>'id';
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
  ELSIF v_status = 'cancelled' THEN v_order_status := 'cancelled';
  END IF;

  -- 3. Payment Status (Resilient detection)
  IF (payload->>'date_paid') IS NOT NULL AND (payload->>'date_paid') != '' THEN
     v_is_paid := true;
     v_payment_status := 'paid';
  ELSIF v_status = 'completed' THEN
     v_is_paid := true;
     v_payment_status := 'paid';
  ELSE
     v_payment_status := 'pending';
  END IF;

  -- 4. Customer Info
  v_customer_email := LOWER(TRIM(payload->'billing'->>'email'));
  v_customer_phone := TRIM(payload->'billing'->>'phone');
  v_customer_name := TRIM(COALESCE(
    NULLIF(TRIM(payload->'billing'->>'first_name') || ' ' || TRIM(payload->'billing'->>'last_name'), ' '),
    NULLIF(TRIM(payload->'shipping'->>'first_name') || ' ' || TRIM(payload->'shipping'->>'last_name'), ' '),
    v_customer_email,
    'Guest Customer'
  ));

  -- 5. Delivery Date (Default 7 days)
  v_delivery_date := COALESCE(
    (payload->>'date_created')::timestamp + interval '7 days', 
    now() + interval '7 days'
  );

  -- 6. Total
  v_total_amount := COALESCE((payload->>'total')::numeric, 0);

  -- 7. Agent Mapping (Whatsapp/Custom fields support)
  IF payload->'meta_data' IS NOT NULL THEN
    FOR v_meta_item IN SELECT * FROM jsonb_array_elements(payload->'meta_data')
    LOOP
       IF (
           LOWER(v_meta_item->>'key') IN ('sales_agent', 'agent', 'ordered_by', '_sales_agent', 'sales_person', 'whatsapp_agent') 
       ) THEN
          v_agent_name := v_meta_item->>'value';
          v_clean_agent_code := LOWER(REPLACE(REPLACE(v_agent_name, ' ', ''), '.', ''));
          EXIT;
       END IF;
    END LOOP;
  END IF;

  -- Resolve Agent ID
  IF v_clean_agent_code IS NOT NULL THEN
      SELECT user_email INTO v_assigned_email FROM public.sales_agent_mapping WHERE sales_agent_code = v_clean_agent_code LIMIT 1;
      IF v_assigned_email IS NOT NULL THEN
          SELECT id INTO v_assigned_user_id FROM auth.users WHERE email = v_assigned_email LIMIT 1;
          IF v_assigned_user_id IS NULL THEN
              SELECT user_id INTO v_assigned_user_id FROM public.profiles WHERE email = v_assigned_email LIMIT 1;
          END IF;
      END IF;
  END IF;

  -- Fallback to Triggering User
  IF v_assigned_user_id IS NULL AND payload->>'_current_user_id' IS NOT NULL THEN
      v_assigned_user_id := (payload->>'_current_user_id')::uuid;
  END IF;

  -- 8. UPSERT CUSTOMER (Link by WC ID or Email)
  v_wc_customer_id := (payload->>'customer_id')::bigint;

  IF v_wc_customer_id > 0 THEN
      SELECT id, assigned_to INTO v_customer_id, v_existing_assigned_to FROM wc_customers WHERE wc_id = v_wc_customer_id LIMIT 1;
  ELSIF v_customer_email IS NOT NULL THEN
      SELECT id, assigned_to INTO v_customer_id, v_existing_assigned_to FROM wc_customers WHERE email = v_customer_email LIMIT 1;
  END IF;

  IF v_customer_id IS NOT NULL THEN
      UPDATE wc_customers SET
        wc_id = CASE WHEN v_wc_customer_id > 0 THEN v_wc_customer_id ELSE wc_id END,
        email = COALESCE(v_customer_email, email),
        first_name = COALESCE(payload->'billing'->>'first_name', first_name),
        last_name = COALESCE(payload->'billing'->>'last_name', last_name),
        phone = COALESCE(v_customer_phone, phone),
        billing = COALESCE(payload->'billing', billing),
        shipping = COALESCE(payload->'shipping', shipping),
        total_spent = COALESCE((payload->>'total')::numeric + total_spent, total_spent),
        orders_count = orders_count + 1,
        assigned_to = COALESCE(assigned_to, v_assigned_user_id),
        updated_at = now()
      WHERE id = v_customer_id;
  ELSE
      INSERT INTO wc_customers (wc_id, email, first_name, last_name, phone, billing, shipping, assigned_to, source, orders_count, total_spent, updated_at)
      VALUES (
        COALESCE(v_wc_customer_id, 0), v_customer_email, payload->'billing'->>'first_name', payload->'billing'->>'last_name',
        v_customer_phone, payload->'billing', payload->'shipping', v_assigned_user_id, 'woocommerce', 1, v_total_amount, now()
      )
      RETURNING id INTO v_customer_id;
  END IF;

  -- 9. UPSERT ORDER (Include Email/Phone for history queries)
  INSERT INTO orders (
    wc_order_id, wc_order_number, customer_id, 
    customer_name, customer_email, customer_phone,
    status, order_status, payment_status, total_amount, order_total, currency,
    delivery_date, assigned_user, assigned_user_email, sales_agent_code,
    current_department, source, raw_wc_payload, updated_at
  )
  VALUES (
    v_wc_order_id, v_order_number, v_customer_id, 
    v_customer_name, v_customer_email, v_customer_phone,
    v_status, v_order_status, v_payment_status, v_total_amount, v_total_amount,
    COALESCE(payload->>'currency', 'INR'), v_delivery_date, 
    COALESCE(v_assigned_user_id, v_existing_assigned_to), 
    v_assigned_email, v_clean_agent_code, 'sales', 'woocommerce', payload, now()
  )
  ON CONFLICT (wc_order_id) DO UPDATE SET
    wc_order_number = EXCLUDED.wc_order_number,
    status = EXCLUDED.status,
    order_status = EXCLUDED.order_status,
    payment_status = EXCLUDED.payment_status,
    total_amount = EXCLUDED.total_amount,
    customer_email = EXCLUDED.customer_email,
    customer_phone = EXCLUDED.customer_phone,
    raw_wc_payload = EXCLUDED.raw_wc_payload,
    customer_id = EXCLUDED.customer_id,
    updated_at = now()
  RETURNING id INTO v_order_id;

  -- 10. REFRESH ITEMS
  DELETE FROM order_items WHERE order_id = v_order_id;
  INSERT INTO order_items (order_id, product_name, quantity, line_total, current_stage, status, delivery_date)
  SELECT v_order_id, item->>'name', (item->>'quantity')::int, (item->>'total')::numeric, 'sales', v_order_status, v_delivery_date
  FROM jsonb_array_elements(payload->'line_items') AS item;

  -- 11. LEDGER (Prevent duplicates)
  IF v_is_paid THEN v_transaction_type := 'CREDIT'; ELSE v_transaction_type := 'DEBIT'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.payment_ledger WHERE order_id = v_order_id AND transaction_type = v_transaction_type) THEN
      INSERT INTO public.payment_ledger (customer_id, order_id, amount, transaction_type, payment_method, created_by)
      VALUES (v_customer_id, v_order_id, v_total_amount, v_transaction_type, v_payment_method, NULL);
  END IF;

  RETURN v_order_id;
END;
$$;

-- 3. BACKFILL: Populate email/phone from raw_wc_payload for existing orders
-- This ensures that stats in useWooCommerce hook become accurate for historical data.
DO $$
BEGIN
    UPDATE orders
    SET 
        customer_email = LOWER(TRIM(raw_wc_payload->'billing'->>'email')),
        customer_phone = TRIM(raw_wc_payload->'billing'->>'phone')
    WHERE (customer_email IS NULL OR customer_phone IS NULL)
      AND raw_wc_payload IS NOT NULL;
END $$;
