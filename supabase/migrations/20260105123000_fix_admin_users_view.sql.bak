-- Drop the old function if it exists to avoid conflicts
drop function if exists public.get_admin_user_profiles();

-- Re-create with TEXT return type for role to avoid enum mismatch issues
create or replace function public.get_admin_user_profiles()
returns table (
    id uuid,
    user_id uuid,
    full_name text,
    department text,
    avatar_url text,
    email text,
    role text, -- Change to text
    hr_data jsonb
) 
security definer
set search_path = public, auth
language plpgsql
as $$
begin
    -- strictly check for admin role
    if not exists (
        select 1 from public.user_roles 
        where user_id = auth.uid() 
        and role = 'admin'
    ) then
        raise exception 'Access denied';
    end if;

    return query
    select 
        p.id,
        p.user_id,
        p.full_name,
        p.department,
        p.avatar_url,
        u.email::text,
        ur.role::text, -- Cast to text
        to_jsonb(hr.*) as hr_data
    from public.profiles p
    join auth.users u on p.user_id = u.id
    left join public.user_roles ur on p.user_id = ur.user_id
    left join public.hr_employees hr on p.user_id = hr.id;
end;
$$;
