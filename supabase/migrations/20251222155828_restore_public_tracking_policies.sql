-- Restore Public Order Tracking Policies
-- The public tracking policy for order_items was dropped in a previous migration
-- but is required for anonymous users to track orders

-- Recreate public policy for order_items (was dropped in 20251224020000)
CREATE POLICY IF NOT EXISTS "Public can view order_items for tracking"
ON public.order_items FOR SELECT
TO anon
USING (true);

COMMENT ON POLICY "Public can view order_items for tracking" ON public.order_items IS 
'Allows anonymous users to query order_items for customer tracking. Frontend MUST filter by order_id and only select safe fields (id, product_name, quantity, current_stage, delivery_date, dispatch_info, is_dispatched).';

-- Ensure public policy for orders exists (should already exist, but ensure it)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'orders'
    AND policyname = 'Public can view orders for tracking'
  ) THEN
    CREATE POLICY "Public can view orders for tracking"
    ON public.orders FOR SELECT
    TO anon
    USING (true);
    
    COMMENT ON POLICY "Public can view orders for tracking" ON public.orders IS 
    'Allows anonymous users to query orders by order_id for customer tracking. Frontend MUST filter by order_id and only select safe fields.';
  END IF;
END $$;

-- Ensure public policy for timeline exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'timeline'
    AND policyname = 'Public can view public timeline entries'
  ) THEN
    CREATE POLICY "Public can view public timeline entries"
    ON public.timeline FOR SELECT
    TO anon
    USING (is_public = true);
    
    COMMENT ON POLICY "Public can view public timeline entries" ON public.timeline IS 
    'Allows anonymous users to read public timeline entries for customer order tracking. Only entries with is_public=true are visible.';
  END IF;
END $$;

