-- Fix order_items UPDATE policy to allow all authenticated users to update items in their department
-- The current policy should work, but let's ensure it applies to 'authenticated' role, not 'public'
DROP POLICY IF EXISTS "Users can update items in their department" ON public.order_items;

CREATE POLICY "Users can update items in their department" 
ON public.order_items 
FOR UPDATE 
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR (assigned_department = get_user_department(auth.uid())) 
  OR has_role(auth.uid(), 'sales'::app_role)
)
WITH CHECK (true);

-- Also update the SELECT policy to allow prepress to see their items
DROP POLICY IF EXISTS "Users can view items based on department" ON public.order_items;

CREATE POLICY "Users can view items based on department" 
ON public.order_items 
FOR SELECT 
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR (assigned_department = get_user_department(auth.uid())) 
  OR has_role(auth.uid(), 'sales'::app_role)
);

-- Fix user_roles INSERT policy for admins to add roles for new users
DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;

CREATE POLICY "Admins can insert roles" 
ON public.user_roles 
FOR INSERT 
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Fix profiles DELETE policy - allow admins to delete profiles
DROP POLICY IF EXISTS "Admins can delete profiles" ON public.profiles;

CREATE POLICY "Admins can delete profiles" 
ON public.profiles 
FOR DELETE 
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Fix user_roles DELETE policy - allow admins to delete roles
DROP POLICY IF EXISTS "Admins can delete roles" ON public.user_roles;

CREATE POLICY "Admins can delete roles" 
ON public.user_roles 
FOR DELETE 
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));