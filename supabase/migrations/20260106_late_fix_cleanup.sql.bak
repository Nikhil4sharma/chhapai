-- Cleanup lingering policies that cause recursion and were missed in previous migrations
-- These policies use has_role() or other checks that might trigger recursion or conflict with new optimized policies

-- user_roles
DROP POLICY IF EXISTS "Authenticated users can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Authenticated users can view all roles for team assignment" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can delete roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can update roles" ON public.user_roles;

-- order_items
DROP POLICY IF EXISTS "Users can update items in their department" ON public.order_items;
DROP POLICY IF EXISTS "Users can view items based on department" ON public.order_items;
DROP POLICY IF EXISTS "Sales and admin can create items" ON public.order_items;
DROP POLICY IF EXISTS "Admins can delete items" ON public.order_items;
DROP POLICY IF EXISTS "Admins and Sales view all items" ON public.order_items;

-- orders
DROP POLICY IF EXISTS "Sales and admin can create orders" ON public.orders;
DROP POLICY IF EXISTS "Sales and admin can update orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can delete orders" ON public.orders;
DROP POLICY IF EXISTS "Users can view orders based on department" ON public.orders;

-- profiles
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can delete profiles" ON public.profiles;
