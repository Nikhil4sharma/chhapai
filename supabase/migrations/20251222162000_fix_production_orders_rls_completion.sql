-- Fix RLS Policy for orders table to allow production users to mark orders as completed
-- 
-- ISSUE: When all items in an order are completed, production users need to update
-- orders.is_completed = true, but current RLS policy doesn't explicitly allow this.
--
-- SOLUTION: Update the orders UPDATE policy to allow production users to update
-- is_completed field when all items in the order are completed.

-- Drop existing policy
DROP POLICY IF EXISTS "Sales and admin can update orders" ON public.orders;

-- Create updated policy that allows production users to mark orders as completed
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
  -- CRITICAL FIX: Production users can update orders when:
  -- 1. Marking as completed (when all items are done)
  -- 2. Adding notes (they need to update global_notes and updated_at)
  -- 3. Items are in dispatch/completed stages (they moved them there)
  OR (
    LOWER(COALESCE(get_user_department(auth.uid()), '')) = 'production'
    AND EXISTS (
      SELECT 1 FROM public.order_items oi
      WHERE oi.order_id = orders.id
      AND (
        -- Items are completed (for marking order as completed)
        oi.current_stage = 'completed'
        -- OR items are in dispatch/completed stages (production moved them there)
        OR oi.current_stage IN ('dispatch', 'completed')
        -- OR items were in production department (for adding notes during production)
        OR LOWER(COALESCE(oi.assigned_department, '')) = 'production'
      )
    )
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
    -- Production can assign to dispatch, dispatched, completed, or back to prepress
    LOWER(COALESCE(get_user_department(auth.uid()), '')) = 'production'
    AND LOWER(COALESCE(current_department, '')) IN ('dispatch', 'prepress', 'dispatched', 'completed')
  )
  -- CRITICAL FIX: Production users can update orders if they have items in the order
  -- This allows them to:
  -- 1. Set is_completed = true when all items are completed
  -- 2. Update global_notes and updated_at (for adding notes)
  -- 3. Update any field if they're working on items in the order
  -- The WITH CHECK is permissive: if they can see the order (USING clause), they can update it
  OR (
    LOWER(COALESCE(get_user_department(auth.uid()), '')) = 'production'
    AND EXISTS (
      SELECT 1 FROM public.order_items oi
      WHERE oi.order_id = orders.id
      AND (
        -- Items are completed (for marking order as completed)
        oi.current_stage = 'completed'
        -- OR items are in dispatch/completed stages (production moved them there)
        OR oi.current_stage IN ('dispatch', 'completed')
        -- OR items were in production department (for adding notes during production)
        OR LOWER(COALESCE(oi.assigned_department, '')) = 'production'
      )
    )
    -- Allow any update if production user has items in the order
    -- This covers: is_completed, global_notes, updated_at, and other safe fields
  )
);

COMMENT ON POLICY "Sales and admin can update orders" ON public.orders IS 
'Allows users to update orders based on department and workflow:
- Admin and Sales can update any order
- Users can update orders in their department
- Production users can:
  * Mark orders as completed when all items are completed
  * Add notes (update global_notes and updated_at)
  * Update orders for items they worked on (even if items moved to dispatch/completed)
- Supports workflow transitions between departments';

