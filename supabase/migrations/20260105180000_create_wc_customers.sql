create table if not exists public.wc_customers (
    id uuid default gen_random_uuid() primary key,
    wc_id bigint unique not null,
    email text,
    first_name text,
    last_name text,
    phone text,
    billing jsonb,
    shipping jsonb,
    avatar_url text,
    total_spent numeric,
    orders_count integer,
    last_order_date text,
    last_synced_at timestamp with time zone default timezone('utc'::text, now()),
    created_at timestamp with time zone default timezone('utc'::text, now()),
    updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- Add RLS policies
alter table public.wc_customers enable row level security;

drop policy if exists "Allow read access to authenticated users" on public.wc_customers;
create policy "Allow read access to authenticated users"
    on public.wc_customers for select
    to authenticated
    using (true);

drop policy if exists "Allow insert/update access to service role only" on public.wc_customers;
create policy "Allow insert/update access to service role only"
    on public.wc_customers for all
    to service_role
    using (true)
    with check (true);

-- Allow admin to read/write as well just in case (optional, but good for dashboard)
drop policy if exists "Allow admin full access" on public.wc_customers;
create policy "Allow admin full access"
    on public.wc_customers for all
    to authenticated
    using (
        exists (
            select 1 from public.user_roles
            where user_id = auth.uid()
            and role in ('admin', 'super_admin')
        )
    );
