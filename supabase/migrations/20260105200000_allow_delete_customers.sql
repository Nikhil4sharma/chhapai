
-- Allow users to delete their assigned customers
create policy "Allow delete access to assigned users"
    on public.wc_customers for delete
    to authenticated
    using (
        auth.uid() = assigned_to 
        or 
        exists (
            select 1 from public.user_roles 
            where user_id = auth.uid() 
            and role in ('admin', 'super_admin')
        )
    );
