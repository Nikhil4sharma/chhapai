-- Fix Access Control and RLS Policies

-- 1. Create a function to check if user is admin (helper)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'super_admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create a function to get user department (helper)
CREATE OR REPLACE FUNCTION public.get_my_department()
RETURNS TEXT AS $$
BEGIN
  RETURN (
    SELECT department FROM public.profiles
    WHERE user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Update Policies for 'orders'
-- Admin: See all
-- Sales: See all
-- Others: See orders that have items in their department

DROP POLICY IF EXISTS "Admins can view all orders" ON public.orders;
DROP POLICY IF EXISTS "Users can view own department orders" ON public.orders;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.orders; -- potentially existing generic policy

CREATE POLICY "Admins and Sales view all orders"
ON public.orders
FOR SELECT
TO authenticated
USING (
  is_admin() OR
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role = 'sales'
  )
);

CREATE POLICY "Department users view relevant orders"
ON public.orders
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.order_items
    WHERE order_items.order_id = orders.id
    AND (
      -- Match item assigned department
      order_items.assigned_department::text = get_my_department()
      OR
      -- Match item status/stage (optional, if department logic relies on stage)
      order_items.current_stage::text = get_my_department()
    )
  )
);


-- 4. Update Policies for 'order_items'
DROP POLICY IF EXISTS "Admins can view all order_items" ON public.order_items;
DROP POLICY IF EXISTS "Users can view own department items" ON public.order_items;

CREATE POLICY "Admins and Sales view all items"
ON public.order_items
FOR SELECT
TO authenticated
USING (
  is_admin() OR
  (SELECT role FROM public.user_roles WHERE user_id = auth.uid()) = 'sales'
);

CREATE POLICY "Department users view assigned items"
ON public.order_items
FOR SELECT
TO authenticated
USING (
   current_stage::text = get_my_department()
   OR
   assigned_department::text = get_my_department()
);

-- 5. Helper trigger to ensure new profiles have a default if needed (Optional, better handled by App logic)
