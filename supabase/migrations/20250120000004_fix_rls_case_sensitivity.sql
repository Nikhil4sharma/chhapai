-- Fix RLS case sensitivity issues
-- Ensure department comparisons are case-insensitive

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
  is_user_sales BOOLEAN;
  has_item_in_dept BOOLEAN;
BEGIN
  -- Admin can see all orders
  is_user_admin := public.is_admin(user_id);
  IF is_user_admin THEN
    RETURN true;
  END IF;

  -- Get user's department (lowercase for case-insensitive comparison)
  user_dept := LOWER(TRIM(COALESCE(public.get_user_department(user_id), '') || ''));
  
  -- Sales can see all orders
  is_user_sales := public.is_sales(user_id);
  IF is_user_sales THEN
    RETURN true;
  END IF;

  -- PRIMARY: Check order-level assignment (current_department + assigned_user)
  -- Use case-insensitive comparison
  IF order_row.current_department IS NOT NULL THEN
    IF LOWER(TRIM(COALESCE(order_row.current_department, '') || '')) = user_dept THEN
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
      AND LOWER(TRIM(COALESCE(oi.assigned_department, '') || '')) = user_dept
      -- REMOVED: AND (oi.assigned_to IS NULL OR oi.assigned_to = user_id)
      -- assigned_to does NOT control department-level visibility
  ) INTO has_item_in_dept;

  RETURN has_item_in_dept;
END;
$$;

-- Add is_sales helper function if not exists
CREATE OR REPLACE FUNCTION public.is_sales(user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_roles.user_id = is_sales.user_id 
    AND user_roles.role = 'sales'::app_role
  );
END;
$$;

COMMENT ON FUNCTION public.can_view_order IS 'RLS helper: Checks if user can view order. Department members can always see orders in their department, even if assigned to another user. Uses case-insensitive comparison.';
COMMENT ON FUNCTION public.is_sales IS 'Helper function to check if user has sales role';

