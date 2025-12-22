-- Fix Order Assignment & Stage Update Permissions
-- 
-- REQUIRED BEHAVIOR:
-- 1. Sales & Admin can assign to ANY department and ANY user
-- 2. Department users can assign to NEXT department and reassign within their department
-- 3. RLS should allow UPDATE when: admin/sales OR user's department = order's current_department

-- Ensure orders table has required columns
DO $$ 
BEGIN
  -- Add current_department if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'orders' 
    AND column_name = 'current_department'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN current_department TEXT;
    COMMENT ON COLUMN public.orders.current_department IS 'Department that currently owns this order (denormalized for performance)';
  END IF;

  -- Add assigned_user if not exists (it may be named assigned_user_id)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'orders' 
    AND column_name = 'assigned_user'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'orders' 
    AND column_name = 'assigned_user_id'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN assigned_user UUID REFERENCES auth.users(id);
    COMMENT ON COLUMN public.orders.assigned_user IS 'User assigned to this order (NULL = visible to all users in current_department)';
  END IF;
END $$;

-- Fix orders table UPDATE RLS policy
-- Allow UPDATE when:
--   - User is admin or sales (can update any order)
--   - OR user's department matches order's current_department (can update orders in their department)
-- Note: Department transitions are handled at order_items level, not orders level
DROP POLICY IF EXISTS "Sales and admin can update orders" ON public.orders;

CREATE POLICY "Sales and admin can update orders"
ON public.orders FOR UPDATE
TO authenticated
USING (
  -- Admin and Sales can update any order
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'sales'::app_role)
  -- OR user's department matches order's current_department
  OR (
    current_department IS NOT NULL
    AND LOWER(COALESCE(current_department, '')) = LOWER(COALESCE(get_user_department(auth.uid()), ''))
  )
  -- OR order has items in user's department (fallback for legacy orders without current_department set)
  OR EXISTS (
    SELECT 1 FROM public.order_items oi
    WHERE oi.order_id = orders.id
    AND LOWER(COALESCE(oi.assigned_department, '')) = LOWER(COALESCE(get_user_department(auth.uid()), ''))
  )
)
WITH CHECK (
  -- Admin and Sales can set any department
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'sales'::app_role)
  -- OR user can keep order in their department (allow same department assignment)
  OR (
    current_department IS NOT NULL
    AND LOWER(COALESCE(current_department, '')) = LOWER(COALESCE(get_user_department(auth.uid()), ''))
  )
  -- OR user can assign to next department in workflow (when assigning via order_items, this updates orders.current_department)
  OR (
    -- Design can assign to prepress or production
    LOWER(COALESCE(get_user_department(auth.uid()), '')) = 'design'
    AND LOWER(COALESCE(current_department, '')) IN ('prepress', 'production')
  )
  OR (
    -- Prepress can assign to production, outsource, or back to design
    LOWER(COALESCE(get_user_department(auth.uid()), '')) = 'prepress'
    AND LOWER(COALESCE(current_department, '')) IN ('production', 'outsource', 'design')
  )
  OR (
    -- Production can assign to dispatch or back to prepress
    LOWER(COALESCE(get_user_department(auth.uid()), '')) = 'production'
    AND LOWER(COALESCE(current_department, '')) IN ('dispatch', 'prepress', 'dispatched')
  )
);

-- Fix order_items table UPDATE RLS policy (ensure it allows department-based assignment)
-- This policy already exists but let's ensure it's correct
DROP POLICY IF EXISTS "Users can update items in their department" ON public.order_items;

CREATE POLICY "Users can update items in their department"
ON public.order_items
FOR UPDATE
TO authenticated
USING (
  -- Admin and Sales can update any item
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'sales'::app_role)
  -- OR user's department matches item's assigned_department
  OR (
    LOWER(COALESCE(assigned_department, '')) = LOWER(COALESCE(get_user_department(auth.uid()), ''))
  )
)
WITH CHECK (
  -- Admin can assign to ANY department
  has_role(auth.uid(), 'admin'::app_role)
  -- Sales can assign to ALL departments
  OR (
    has_role(auth.uid(), 'sales'::app_role)
    AND LOWER(COALESCE(assigned_department, '')) IN ('sales', 'design', 'prepress', 'production', 'outsource', 'dispatch', 'dispatched')
  )
  -- Design users can assign to sales (backward), design (same), or prepress (forward)
  OR (
    LOWER(COALESCE(get_user_department(auth.uid()), '')) = 'design'
    AND LOWER(COALESCE(assigned_department, '')) IN ('sales', 'design', 'prepress')
  )
  -- Prepress users can assign to sales, design (backward), outsource, or production (forward)
  OR (
    LOWER(COALESCE(get_user_department(auth.uid()), '')) = 'prepress'
    AND LOWER(COALESCE(assigned_department, '')) IN ('sales', 'design', 'prepress', 'outsource', 'production')
  )
  -- Production users can assign to prepress (backward), production (same), dispatch, or completed (forward)
  OR (
    LOWER(COALESCE(get_user_department(auth.uid()), '')) = 'production'
    AND LOWER(COALESCE(assigned_department, '')) IN ('prepress', 'production', 'dispatch', 'dispatched', 'completed')
  )
  -- CRITICAL: Allow users to keep items in their own department (for other field updates like current_stage, current_substage, etc.)
  OR (
    LOWER(COALESCE(assigned_department, '')) = LOWER(COALESCE(get_user_department(auth.uid()), ''))
  )
);

-- Ensure order_activity_logs table exists and has correct structure
DO $$
BEGIN
  -- Check if order_activity_logs table exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'order_activity_logs'
  ) THEN
    -- Create order_activity_logs table
    CREATE TABLE public.order_activity_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
      item_id UUID REFERENCES public.order_items(id) ON DELETE CASCADE,
      department TEXT NOT NULL CHECK (department IN ('sales', 'design', 'prepress', 'production', 'dispatch')),
      action TEXT NOT NULL CHECK (action IN ('created', 'assigned', 'started', 'completed', 'rejected', 'dispatched', 'note_added', 'file_uploaded', 'status_changed', 'outsource_assigned', 'outsource_dispatched', 'outsource_received', 'quality_check_performed', 'qc_decision_made')),
      message TEXT NOT NULL,
      created_by UUID REFERENCES auth.users(id),
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      metadata JSONB DEFAULT '{}'
    );

    -- Create indexes
    CREATE INDEX idx_order_activity_logs_order_id ON public.order_activity_logs(order_id);
    CREATE INDEX idx_order_activity_logs_item_id ON public.order_activity_logs(item_id);
    CREATE INDEX idx_order_activity_logs_department ON public.order_activity_logs(department);
    CREATE INDEX idx_order_activity_logs_created_at ON public.order_activity_logs(created_at DESC);
    CREATE INDEX idx_order_activity_logs_order_dept ON public.order_activity_logs(order_id, department);

    -- Enable RLS
    ALTER TABLE public.order_activity_logs ENABLE ROW LEVEL SECURITY;

    -- RLS Policies for order_activity_logs
    CREATE POLICY "Users can view activity logs for accessible orders"
    ON public.order_activity_logs FOR SELECT
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.orders o
        WHERE o.id = order_activity_logs.order_id
        AND (
          public.has_role(auth.uid(), 'admin'::app_role) OR
          public.has_role(auth.uid(), 'sales'::app_role) OR
          EXISTS (
            SELECT 1 FROM public.order_items oi
            WHERE oi.order_id = o.id
            AND oi.assigned_department = public.get_user_department(auth.uid())
          )
        )
      )
    );

    CREATE POLICY "Authenticated users can insert activity logs"
    ON public.order_activity_logs FOR INSERT
    TO authenticated
    WITH CHECK (
      public.has_role(auth.uid(), 'admin'::app_role) OR
      public.has_role(auth.uid(), 'sales'::app_role) OR
      public.has_role(auth.uid(), 'design'::app_role) OR
      public.has_role(auth.uid(), 'prepress'::app_role) OR
      public.has_role(auth.uid(), 'production'::app_role)
      -- Note: 'dispatch' is a workflow stage, not a user role, so it's not checked here
    );

    -- Enable realtime
    ALTER PUBLICATION supabase_realtime ADD TABLE public.order_activity_logs;
  END IF;
END $$;

-- Add comment for documentation
COMMENT ON POLICY "Sales and admin can update orders" ON public.orders IS 
'Allows Sales/Admin to update any order, or department users to update orders in their current_department';

COMMENT ON POLICY "Users can update items in their department" ON public.order_items IS 
'Allows Sales/Admin to update any item, or department users to update items in their assigned_department with workflow-based department transitions';

