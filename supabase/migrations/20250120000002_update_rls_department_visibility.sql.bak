-- Update RLS function to ensure department can see assigned orders (read-only)
-- Even if an order is assigned to a specific user, department members can still see it

CREATE OR REPLACE FUNCTION public.can_view_order(order_row public.orders, user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_dept TEXT;
  is_user_admin BOOLEAN;
  has_item_in_dept BOOLEAN;
BEGIN
  -- Admin can see all orders
  is_user_admin := public.is_admin(user_id);
  IF is_user_admin THEN
    RETURN true;
  END IF;

  -- Get user's department (lowercase for case-insensitive comparison)
  user_dept := LOWER(TRIM(public.get_user_department(user_id) || ''));
  
  -- Sales can see all orders (legacy behavior)
  IF user_dept = 'sales' THEN
    RETURN true;
  END IF;

  -- PRIMARY: Check order-level assignment (current_department + assigned_user)
  -- Use case-insensitive comparison
  IF order_row.current_department IS NOT NULL THEN
    IF LOWER(TRIM(order_row.current_department || '')) = user_dept THEN
      -- CRITICAL: Department members can ALWAYS see orders in their department
      -- Even if assigned_user is set, department can see it (read-only visibility)
      -- The assigned_user check is only for UPDATE permissions, not SELECT
      RETURN true;
    END IF;
    -- If current_department is set but doesn't match, deny (don't fall back to items)
    RETURN false;
  END IF;

  -- FALLBACK: If order-level assignment not set, check item-level assignment
  -- This provides backward compatibility during migration
  -- CRITICAL FIX: Do NOT filter by assigned_to here
  -- Department users should see ALL items in their department, regardless of assigned_to
  -- Use case-insensitive comparison for assigned_department
  SELECT EXISTS (
    SELECT 1 FROM public.order_items oi
    WHERE oi.order_id = order_row.id
      AND LOWER(TRIM(oi.assigned_department || '')) = user_dept
      -- REMOVED: AND (oi.assigned_to IS NULL OR oi.assigned_to = user_id)
      -- assigned_to does NOT control department-level visibility
  ) INTO has_item_in_dept;

  RETURN has_item_in_dept;
END;
$$;

-- Update UPDATE policy to ensure only assigned user or admin can update
-- Department members can view but not update assigned orders
CREATE POLICY "Orders: Update assigned user or admin"
ON public.orders FOR UPDATE
TO authenticated
USING (
  public.is_admin(auth.uid()) OR 
  -- User can update if they're the assigned user OR if order is unassigned in their department
  (
    public.can_view_order(orders, auth.uid()) AND
    (orders.assigned_user IS NULL OR orders.assigned_user = auth.uid())
  )
)
WITH CHECK (
  public.is_admin(auth.uid()) OR 
  (
    public.can_view_order(orders, auth.uid()) AND
    (orders.assigned_user IS NULL OR orders.assigned_user = auth.uid())
  )
);

-- Drop old update policy if it exists
DROP POLICY IF EXISTS "Orders: Update in department or admin" ON public.orders;

COMMENT ON FUNCTION public.can_view_order IS 'RLS helper: Checks if user can view order. Department members can always see orders in their department, even if assigned to another user.';

