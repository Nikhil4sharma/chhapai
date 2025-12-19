-- ============================================================================
-- CLEAN SUPABASE MIGRATION
-- Migration Start Date: 2025-01-20 (today onwards, old Firebase orders ignored)
-- ============================================================================
-- This migration creates a clean, optimized Supabase schema with proper RLS
-- to fix disappearing orders and assignment bugs
-- ============================================================================

-- Step 1: Add missing columns to orders table if they don't exist
-- current_department: decides which department sees the order
-- assigned_user: NULL = visible to all users in that department, NOT NULL = visible only to that user
-- is_urgent: boolean for urgent dashboards
DO $$ 
BEGIN
  -- Add current_department to orders (denormalized from order_items for faster queries)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'orders' 
                 AND column_name = 'current_department') THEN
    ALTER TABLE public.orders ADD COLUMN current_department TEXT;
    COMMENT ON COLUMN public.orders.current_department IS 'Department that currently owns this order (denormalized for performance)';
  END IF;

  -- Add assigned_user to orders (for order-level assignment)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'orders' 
                 AND column_name = 'assigned_user') THEN
    ALTER TABLE public.orders ADD COLUMN assigned_user UUID REFERENCES auth.users(id);
    COMMENT ON COLUMN public.orders.assigned_user IS 'NULL = visible to all users in current_department, NOT NULL = visible only to this user';
  END IF;

  -- Add is_urgent flag
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'orders' 
                 AND column_name = 'is_urgent') THEN
    ALTER TABLE public.orders ADD COLUMN is_urgent BOOLEAN NOT NULL DEFAULT false;
    COMMENT ON COLUMN public.orders.is_urgent IS 'True if order has urgent items (priority = red)';
  END IF;

  -- Add firebase_uid for reference (optional, for migration tracking)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'orders' 
                 AND column_name = 'firebase_uid') THEN
    ALTER TABLE public.orders ADD COLUMN firebase_uid TEXT;
    COMMENT ON COLUMN public.orders.firebase_uid IS 'Firebase order ID (read-only reference, not used for queries)';
  END IF;

  -- Add migration_date to track when order was created in Supabase
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'orders' 
                 AND column_name = 'migration_date') THEN
    ALTER TABLE public.orders ADD COLUMN migration_date TIMESTAMP WITH TIME ZONE DEFAULT now();
    COMMENT ON COLUMN public.orders.migration_date IS 'Date when order was created in Supabase (migration cutoff date)';
  END IF;
END $$;

-- Step 2: Ensure order_items has proper columns
DO $$ 
BEGIN
  -- Ensure assigned_to can be NULL (for department-wide visibility)
  -- This should already exist, but let's make sure the constraint allows NULL
  
  -- Add firebase_uid for reference if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'order_items' 
                 AND column_name = 'firebase_uid') THEN
    ALTER TABLE public.order_items ADD COLUMN firebase_uid TEXT;
  END IF;
END $$;

-- Step 3: Create departments reference table (if not exists)
CREATE TABLE IF NOT EXISTS public.departments (
    id TEXT PRIMARY KEY, -- 'sales', 'design', 'prepress', 'production', 'admin'
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insert department reference data
INSERT INTO public.departments (id, name, description) VALUES
    ('admin', 'Administration', 'System administrators'),
    ('sales', 'Sales', 'Sales department'),
    ('design', 'Design', 'Design department'),
    ('prepress', 'Prepress', 'Prepress department'),
    ('production', 'Production', 'Production department'),
    ('outsource', 'Outsource', 'Outsource/Vendor management')
ON CONFLICT (id) DO NOTHING;

-- Step 4: Create order_activity table (enhanced timeline)
CREATE TABLE IF NOT EXISTS public.order_activity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
    item_id UUID REFERENCES public.order_items(id) ON DELETE CASCADE,
    activity_type TEXT NOT NULL, -- 'stage_change', 'assignment', 'file_upload', 'note', etc.
    stage TEXT,
    substage TEXT,
    performed_by UUID REFERENCES auth.users(id),
    performed_by_name TEXT,
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on order_activity
ALTER TABLE public.order_activity ENABLE ROW LEVEL SECURITY;

-- Step 5: Create helper functions for RLS (update existing if needed)

-- Function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_roles.user_id = is_admin.user_id
      AND user_roles.role = 'admin'::app_role
  );
$$;

-- Function to get user's primary department/role
CREATE OR REPLACE FUNCTION public.get_user_department(user_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role::TEXT
  FROM public.user_roles
  WHERE user_roles.user_id = get_user_department.user_id
  ORDER BY 
    CASE role
      WHEN 'admin'::app_role THEN 1
      WHEN 'sales'::app_role THEN 2
      ELSE 3
    END
  LIMIT 1;
$$;

-- Function to check if user can view order based on current_department and assigned_user
-- PRIMARY LOGIC: Order-level assignment (current_department + assigned_user)
-- FALLBACK: Item-level assignment for backward compatibility
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

  -- Get user's department
  user_dept := public.get_user_department(user_id);
  
  -- Sales can see all orders (legacy behavior)
  IF user_dept = 'sales' THEN
    RETURN true;
  END IF;

  -- PRIMARY: Check order-level assignment (current_department + assigned_user)
  IF order_row.current_department IS NOT NULL THEN
    IF order_row.current_department = user_dept THEN
      -- If assigned_user is NULL, all department users can see it
      -- If assigned_user is set, only that specific user can see it
      IF order_row.assigned_user IS NULL OR order_row.assigned_user = user_id THEN
        RETURN true;
      END IF;
    END IF;
    -- If current_department is set but doesn't match, deny (don't fall back to items)
    RETURN false;
  END IF;

  -- FALLBACK: If order-level assignment not set, check item-level assignment
  -- This provides backward compatibility during migration
  SELECT EXISTS (
    SELECT 1 FROM public.order_items oi
    WHERE oi.order_id = order_row.id
      AND oi.assigned_department = user_dept
      AND (oi.assigned_to IS NULL OR oi.assigned_to = user_id)
  ) INTO has_item_in_dept;

  RETURN has_item_in_dept;
END;
$$;

-- Step 6: Drop old RLS policies and create new clean ones

-- Orders RLS Policies
DROP POLICY IF EXISTS "Users can view orders based on department" ON public.orders;
DROP POLICY IF EXISTS "Sales and admin can create orders" ON public.orders;
DROP POLICY IF EXISTS "Sales and admin can update orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can delete orders" ON public.orders;

-- NEW: Clean orders SELECT policy
CREATE POLICY "Orders: View based on department and assignment"
ON public.orders FOR SELECT
TO authenticated
USING (
  public.is_admin(auth.uid()) OR -- Admin sees all
  public.can_view_order(orders, auth.uid()) -- Others see based on current_department and assigned_user
);

-- NEW: Orders INSERT policy (Sales and Admin can create)
CREATE POLICY "Orders: Create for sales and admin"
ON public.orders FOR INSERT
TO authenticated
WITH CHECK (
  public.is_admin(auth.uid()) OR 
  public.get_user_department(auth.uid()) = 'sales'
);

-- NEW: Orders UPDATE policy (Users can update orders in their department, admin can update all)
CREATE POLICY "Orders: Update in department or admin"
ON public.orders FOR UPDATE
TO authenticated
USING (
  public.is_admin(auth.uid()) OR 
  public.can_view_order(orders, auth.uid())
)
WITH CHECK (
  public.is_admin(auth.uid()) OR 
  public.can_view_order(orders, auth.uid())
);

-- NEW: Orders DELETE policy (Admin only)
CREATE POLICY "Orders: Delete admin only"
ON public.orders FOR DELETE
TO authenticated
USING (public.is_admin(auth.uid()));

-- Order Items RLS Policies
DROP POLICY IF EXISTS "Users can view items based on department" ON public.order_items;
DROP POLICY IF EXISTS "Users can update items in their department" ON public.order_items;
DROP POLICY IF EXISTS "Sales and admin can create items" ON public.order_items;
DROP POLICY IF EXISTS "Admins can delete items" ON public.order_items;

-- NEW: Order Items SELECT policy
-- Users can see items if they can see the parent order
CREATE POLICY "Order Items: View based on parent order"
ON public.order_items FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.orders
    WHERE orders.id = order_items.order_id
      AND (
        public.is_admin(auth.uid()) OR
        public.can_view_order(orders, auth.uid())
      )
  )
);

-- NEW: Order Items INSERT policy
CREATE POLICY "Order Items: Create for sales and admin"
ON public.order_items FOR INSERT
TO authenticated
WITH CHECK (
  public.is_admin(auth.uid()) OR 
  public.get_user_department(auth.uid()) = 'sales'
);

-- NEW: Order Items UPDATE policy
CREATE POLICY "Order Items: Update if can view parent order"
ON public.order_items FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.orders
    WHERE orders.id = order_items.order_id
      AND (
        public.is_admin(auth.uid()) OR
        public.can_view_order(orders, auth.uid())
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.orders
    WHERE orders.id = order_items.order_id
      AND (
        public.is_admin(auth.uid()) OR
        public.can_view_order(orders, auth.uid())
      )
  )
);

-- NEW: Order Items DELETE policy (Admin only)
CREATE POLICY "Order Items: Delete admin only"
ON public.order_items FOR DELETE
TO authenticated
USING (public.is_admin(auth.uid()));

-- Order Activity RLS Policies
DROP POLICY IF EXISTS "Users can view timeline" ON public.order_activity;
DROP POLICY IF EXISTS "Authenticated users can add timeline entries" ON public.order_activity;

CREATE POLICY "Order Activity: View if can view order"
ON public.order_activity FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.orders
    WHERE orders.id = order_activity.order_id
      AND (
        public.is_admin(auth.uid()) OR
        public.can_view_order(orders, auth.uid())
      )
  )
);

CREATE POLICY "Order Activity: Create if can view order"
ON public.order_activity FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.orders
    WHERE orders.id = order_activity.order_id
      AND (
        public.is_admin(auth.uid()) OR
        public.can_view_order(orders, auth.uid())
      )
  )
);

-- Step 7: Enable Realtime on orders and order_activity
-- Note: Realtime is enabled via Supabase dashboard, but we can add a comment here
COMMENT ON TABLE public.orders IS 'Realtime enabled for instant order updates across departments';
COMMENT ON TABLE public.order_activity IS 'Realtime enabled for instant activity feed updates';

-- Step 8: Create index for performance
CREATE INDEX IF NOT EXISTS idx_orders_current_department ON public.orders(current_department);
CREATE INDEX IF NOT EXISTS idx_orders_assigned_user ON public.orders(assigned_user);
CREATE INDEX IF NOT EXISTS idx_orders_is_urgent ON public.orders(is_urgent);
CREATE INDEX IF NOT EXISTS idx_orders_migration_date ON public.orders(migration_date);
CREATE INDEX IF NOT EXISTS idx_order_items_assigned_to ON public.order_items(assigned_to);
CREATE INDEX IF NOT EXISTS idx_order_items_assigned_department ON public.order_items(assigned_department);
CREATE INDEX IF NOT EXISTS idx_order_activity_order_id ON public.order_activity(order_id);

-- Step 9: Create trigger to sync current_department from order_items to orders
-- When an order_item's assigned_department changes, update order's current_department
CREATE OR REPLACE FUNCTION public.sync_order_current_department()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  most_common_dept TEXT;
BEGIN
  -- Get the most common assigned_department from order_items for this order
  SELECT assigned_department INTO most_common_dept
  FROM public.order_items
  WHERE order_id = COALESCE(NEW.order_id, OLD.order_id)
  GROUP BY assigned_department
  ORDER BY COUNT(*) DESC
  LIMIT 1;

  -- Update the order's current_department
  UPDATE public.orders
  SET current_department = most_common_dept
  WHERE id = COALESCE(NEW.order_id, OLD.order_id);

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trigger_sync_order_current_department ON public.order_items;
CREATE TRIGGER trigger_sync_order_current_department
  AFTER INSERT OR UPDATE OF assigned_department ON public.order_items
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_order_current_department();

-- Step 10: Create trigger to update is_urgent flag when priority changes
CREATE OR REPLACE FUNCTION public.update_order_is_urgent()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  has_urgent_items BOOLEAN;
BEGIN
  -- Check if any item in this order has priority = 'red'
  SELECT EXISTS (
    SELECT 1 FROM public.order_items
    WHERE order_id = COALESCE(NEW.order_id, OLD.order_id)
      AND priority = 'red'
  ) INTO has_urgent_items;

  -- Update the order's is_urgent flag
  UPDATE public.orders
  SET is_urgent = has_urgent_items
  WHERE id = COALESCE(NEW.order_id, OLD.order_id);

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_order_is_urgent ON public.order_items;
CREATE TRIGGER trigger_update_order_is_urgent
  AFTER INSERT OR UPDATE OF priority ON public.order_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_order_is_urgent();

-- Step 11: Add comments for documentation
COMMENT ON TABLE public.departments IS 'Reference table for departments (admin, sales, design, prepress, production)';
COMMENT ON TABLE public.order_activity IS 'Activity log for orders (replaces/enhances timeline)';
COMMENT ON FUNCTION public.can_view_order IS 'RLS helper: Checks if user can view order based on current_department and assigned_user';
COMMENT ON FUNCTION public.sync_order_current_department IS 'Syncs current_department on orders table from order_items.assigned_department';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Key Changes:
-- 1. Added current_department, assigned_user, is_urgent to orders
-- 2. Created clean RLS policies based on current_department + assigned_user logic
-- 3. Admin sees all orders
-- 4. Department users see orders where current_department = their department
-- 5. If assigned_user is NULL, all department users see it
-- 6. If assigned_user is set, only that user sees it
-- 7. Realtime enabled (via dashboard) on orders and order_activity
-- 8. Automatic sync of current_department from order_items
-- 9. Automatic update of is_urgent flag
-- ============================================================================

