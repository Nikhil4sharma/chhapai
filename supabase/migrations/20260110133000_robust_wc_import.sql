-- ==============================================================================
-- ROBUST WOOCOMMERCE IMPORT PIPELINE (SCHEMA & RPC)
-- ==============================================================================

-- 1. Ensure wc_customers has wc_customer_id (text unique)
do $$ 
begin
    if not exists (select 1 from information_schema.columns where table_name = 'wc_customers' and column_name = 'wc_customer_id') then
        alter table wc_customers add column wc_customer_id text;
        
        -- Migrate existing wc_id to wc_customer_id if strictly necessary
        -- Assuming wc_id is numeric, casting to text
        if exists (select 1 from information_schema.columns where table_name = 'wc_customers' and column_name = 'wc_id') then
             update wc_customers set wc_customer_id = wc_id::text where wc_customer_id is null;
        end if;

        alter table wc_customers add constraint wc_customers_wc_customer_id_unique unique (wc_customer_id);
    end if;
end $$;

-- 2. Ensure orders has wc_order_id (text unique) and total_amount
do $$ 
begin
    -- wc_order_id
    if not exists (select 1 from information_schema.columns where table_name = 'orders' and column_name = 'wc_order_id') then
        alter table orders add column wc_order_id text;
        
        -- Migrate woo_order_id to wc_order_id
        if exists (select 1 from information_schema.columns where table_name = 'orders' and column_name = 'woo_order_id') then
            update orders set wc_order_id = woo_order_id where wc_order_id is null;
        end if;

        alter table orders add constraint orders_wc_order_id_unique unique (wc_order_id);
    end if;

    -- total_amount
    if not exists (select 1 from information_schema.columns where table_name = 'orders' and column_name = 'total_amount') then
        alter table orders add column total_amount numeric;
        
        if exists (select 1 from information_schema.columns where table_name = 'orders' and column_name = 'order_total') then
             update orders set total_amount = order_total where total_amount is null;
        end if;
    end if;
end $$;

-- 3. Ensure order_items has proper columns
-- We need ensure 'specifications' exists (User RPC uses 'specs', we will map logic)
-- 'specs' column in RPC will map to 'specifications' in DB if 'specifications' exists.
-- The user RPC code uses "specs jsonb". I will modify RPC to use 'specifications' if that's what we have.
-- Let's assume we want to standardise on 'specifications'.

-- 4. THE RPC FUNCTION
create or replace function import_wc_order(payload jsonb)
returns uuid
language plpgsql
security definer
as $$
declare
  v_customer_id uuid;
  v_order_id uuid;
begin
  -- 1️⃣ CUSTOMER UPSERT
  insert into wc_customers (wc_customer_id, first_name, last_name, email, phone, billing)
  values (
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
  on conflict (wc_customer_id)
  do update set
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    email = excluded.email,
    phone = excluded.phone,
    billing = excluded.billing
  returning id into v_customer_id;

  -- 2️⃣ ORDER UPSERT
  insert into orders (
    wc_order_id,
    customer_id,
    status,
    payment_status,
    total_amount,
    source,
    created_at,
    updated_at
  )
  values (
    payload->>'order_id',
    v_customer_id,
    payload->>'status',
    'pending',  -- Always pending for imports, manual payment update required
    (payload->>'total')::numeric,
    'woocommerce',
    now(),
    now()
  )
  on conflict (wc_order_id)
  do update set
    status = excluded.status,
    total_amount = excluded.total_amount,
    updated_at = now()
  returning id into v_order_id;

  -- 3️⃣ CLEAR OLD ITEMS (for idempotency/updates)
  delete from order_items where order_id = v_order_id;

  -- 4️⃣ INSERT ITEMS
  -- Mapping 'specs' from payload to 'specifications' column in table
  insert into order_items (order_id, product_name, quantity, specifications, line_total, current_stage, status)
  select
    v_order_id,
    item->>'name',
    (item->>'quantity')::int,
    item->'specs',
    (item->>'price')::numeric, -- Mapping price to line_total/price
    'sales', -- Default stage
    'new_order' -- Default status
  from jsonb_array_elements(payload->'items') as item;

  return v_order_id;
end;
$$;

-- Permissions
grant execute on function import_wc_order to authenticated;
