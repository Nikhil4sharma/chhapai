
-- Add assigned_to column to link customers to system users
alter table public.wc_customers 
add column if not exists assigned_to uuid references auth.users(id);

-- Enable RLS (just in case)
alter table public.wc_customers enable row level security;

-- Drop old broad read policy
drop policy if exists "Allow read access to authenticated users" on public.wc_customers;

-- Create new scoped read policy
create policy "Allow read access to assigned users"
    on public.wc_customers for select
    to authenticated
    using (
        -- User can see customers assigned to them
        auth.uid() = assigned_to 
        or 
        -- OR User is an admin
        exists (
            select 1 from public.user_roles 
            where user_id = auth.uid() 
            and role in ('admin', 'super_admin')
        )
    );

-- Allow service role full access (for Edge Functions)
drop policy if exists "Allow insert/update access to service role only" on public.wc_customers;
create policy "Allow insert/update access to service role only"
    on public.wc_customers for all
    to service_role
    using (true)
    with check (true);
