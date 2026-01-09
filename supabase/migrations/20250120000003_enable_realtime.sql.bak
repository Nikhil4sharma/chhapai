-- Enable Realtime on orders table for instant updates
-- This ensures orders appear/disappear instantly when imported or reassigned

-- Enable Realtime publication for orders
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;

-- Enable Realtime publication for order_items
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_items;

-- Enable Realtime publication for timeline
ALTER PUBLICATION supabase_realtime ADD TABLE public.timeline;

-- Add comments
COMMENT ON TABLE public.orders IS 'Orders table with Realtime enabled for instant updates';
COMMENT ON TABLE public.order_items IS 'Order items table with Realtime enabled for instant updates';
COMMENT ON TABLE public.timeline IS 'Timeline table with Realtime enabled for instant updates';

