-- Check existing policies on orders
select * from pg_policies where tablename = 'orders';

-- Check existing policies on order_items
select * from pg_policies where tablename = 'order_items';

-- Check function definition
select prosrc from pg_proc where proname = 'get_user_department';

-- Check design users
select u.id, u.email, ur.role 
from auth.users u 
join public.user_roles ur on u.id = ur.user_id 
where ur.role = 'design' or ur.role = 'Design';
