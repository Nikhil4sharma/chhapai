-- Fix RLS policy to ensure design department can assign orders to prepress
-- Also ensure proper error handling for order_activity_logs table (may not exist during migration)

-- Drop and recreate the UPDATE policy for order_items with explicit design->prepress permission
DROP POLICY IF EXISTS "Users can update items in their department" ON public.order_items;

CREATE POLICY "Users can update items in their department"
ON public.order_items
FOR UPDATE
TO authenticated
USING (
  -- Admin can update anything
  has_role(auth.uid(), 'admin'::app_role)
  -- Sales can update any items
  OR has_role(auth.uid(), 'sales'::app_role)
  -- Users can update items currently in their department (what they can see/access)
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
  -- CRITICAL: Design users can assign to sales (backward), design (same), or prepress (forward)
  -- This is the key fix - ensure design can definitely assign to prepress
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

-- Ensure order_activity_logs table exists (if migration hasn't run yet, this won't fail)
DO $$
BEGIN
  -- Check if order_activity_logs table exists
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'order_activity_logs'
  ) THEN
    -- Table exists - ensure RLS is enabled
    ALTER TABLE public.order_activity_logs ENABLE ROW LEVEL SECURITY;
    
    -- Ensure realtime is enabled
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'order_activity_logs'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.order_activity_logs;
    END IF;
  END IF;
END $$;

