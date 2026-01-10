-- ==============================================================================
-- ROBUST WOOCOMMERCE IMPORT PIPELINE (SCHEMA & RPC)
-- ==============================================================================

-- 1. Ensure wc_customers columns and constraints
do $$ 
begin
    -- Ensure wc_customer_id exists
    if not exists (select 1 from information_schema.columns where table_name = 'wc_customers' and column_name = 'wc_customer_id') then
        alter table wc_customers add column wc_customer_id text;
    end if;

    -- Make wc_id nullable to support Guests or text-based IDs
    alter table wc_customers alter column wc_id drop not null;

    -- Sync existing wc_id to wc_customer_id if empty
    update wc_customers set wc_customer_id = wc_id::text where wc_customer_id is null and wc_id is not null;

    -- Add unique constraint on wc_customer_id if not exists
    if not exists (select 1 from pg_constraint where conname = 'wc_customers_wc_customer_id_unique') then
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

do $$ 
begin
    -- Add last_workflow_note column if it doesn't exist
    if not exists (
        select 1 from information_schema.columns 
        where table_schema = 'public' 
        and table_name = 'order_items' 
        and column_name = 'last_workflow_note'
    ) then
        alter table public.order_items add column last_workflow_note text;
        comment on column public.order_items.last_workflow_note 
        is 'Most recent workflow note/instruction for this item. May include [APPROVE] or [REJECT] prefixes.';
    end if;
end $$;

-- 4. THE RPC FUNCTION
create or replace function import_wc_order(payload jsonb)
returns uuid
language plpgsql
security definer
as $$
declare
  v_customer_id uuid;
  v_order_id uuid;
  v_wc_id_val bigint;
begin
  -- Extract numeric WC ID if possible, else NULL
  begin
    v_wc_id_val := (payload->'customer'->>'id')::bigint;
  exception when others then
    v_wc_id_val := null;
  end;

  -- 1️⃣ CUSTOMER UPSERT
  insert into wc_customers (wc_customer_id, wc_id, first_name, email, phone, billing)
  values (
    payload->'customer'->>'id',
    v_wc_id_val,
    split_part(payload->'customer'->>'name', ' ', 1),
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
    wc_id = coalesce(excluded.wc_id, wc_customers.wc_id),
    first_name = excluded.first_name,
    email = excluded.email,
    phone = excluded.phone,
    billing = excluded.billing
  returning id into v_customer_id;

  -- 2️⃣ ORDER UPSERT
  insert into orders (
    wc_order_id,
    order_id,
    customer_id,
    order_status,
    payment_status,
    total_amount,
    source,
    customer_name,   -- Added Required Column
    customer_email,  -- Likely Required
    customer_phone,  -- Likely Required
    created_at,
    updated_at
  )
  values (
    payload->>'order_id',
    payload->>'order_id',
    v_customer_id,
    payload->>'status',
    payload->>'payment_status',
    (payload->>'total')::numeric,
    'woocommerce',
    payload->'customer'->>'name',   -- Map customer name
    payload->'customer'->>'email',  -- Map customer email
    payload->'customer'->>'phone',  -- Map customer phone
    now(),
    now()
  )
  on conflict (wc_order_id)
  do update set
    order_status = excluded.order_status,
    payment_status = excluded.payment_status,
    total_amount = excluded.total_amount,
    updated_at = now()
  returning id into v_order_id;

  -- 3️⃣ CLEAR OLD ITEMS
  delete from order_items where order_id = v_order_id;

  -- 4️⃣ INSERT ITEMS
  insert into order_items (order_id, product_name, quantity, specifications, line_total, current_stage, status)
  select
    v_order_id,
    item->>'name',
    (item->>'quantity')::int,
    item->'specs',
    (item->>'price')::numeric,
    'sales',
    'new_order'
  from jsonb_array_elements(payload->'items') as item;

  return v_order_id;
end;
$$;

-- Permissions
grant execute on function import_wc_order to authenticated;
