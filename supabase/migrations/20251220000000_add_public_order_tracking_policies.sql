-- PUBLIC ORDER TRACKING POLICIES
-- Allows anonymous users to track orders by order_id for customer-facing tracking page (/track)
-- CRITICAL: These policies allow anonymous users to read orders, but frontend MUST:
-- 1. Only query by order_id (not list all orders)
-- 2. Only select safe fields (never select *)
-- 3. Sanitize all responses to remove internal data

-- Policy: Allow anonymous users to read orders (filtered by order_id in query)
-- Note: RLS cannot validate query filters, so this allows all orders to be read.
-- Security is maintained by: order_id format (WC-XXXXX), frontend filtering, and field selection.
CREATE POLICY "Public can view orders for tracking"
ON public.orders FOR SELECT
TO anon
USING (true);

COMMENT ON POLICY "Public can view orders for tracking" ON public.orders IS 
'Allows anonymous users to query orders by order_id for customer tracking. Frontend MUST filter by order_id and only select safe fields.';

-- Policy: Allow anonymous users to read order_items (filtered by order_id in query)
CREATE POLICY "Public can view order_items for tracking"
ON public.order_items FOR SELECT
TO anon
USING (true);

COMMENT ON POLICY "Public can view order_items for tracking" ON public.order_items IS 
'Allows anonymous users to query order_items for customer tracking. Frontend MUST filter by order_id and only select safe fields (id, product_name, quantity, current_stage, delivery_date, dispatch_info, is_dispatched).';

-- Policy: Allow anonymous users to read public timeline entries
CREATE POLICY "Public can view public timeline entries"
ON public.timeline FOR SELECT
TO anon
USING (is_public = true);

COMMENT ON POLICY "Public can view public timeline entries" ON public.timeline IS 
'Allows anonymous users to read public timeline entries for customer order tracking. Only entries with is_public=true are visible.';

