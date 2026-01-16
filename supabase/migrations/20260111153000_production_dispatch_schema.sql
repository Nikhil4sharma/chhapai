-- Add production workflow fields to order_items
ALTER TABLE public.order_items 
ADD COLUMN IF NOT EXISTS production_stage_sequence JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS current_substage TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS substage_status TEXT DEFAULT 'pending'; -- pending, in_progress, completed

-- Add dispatch info to orders
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS dispatch_info JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS shipping_method TEXT DEFAULT NULL; -- 'courier' or 'pickup'

-- Add comment for documentation
COMMENT ON COLUMN public.order_items.production_stage_sequence IS 'List of production stages required for this item (e.g., ["foiling", "cutting"])';
COMMENT ON COLUMN public.order_items.current_substage IS 'The current active production stage';
COMMENT ON COLUMN public.order_items.substage_status IS 'Status of the current substage: pending, in_progress, or completed';

COMMENT ON COLUMN public.orders.dispatch_info IS 'JSON object containing courier details, tracking number, etc.';
COMMENT ON COLUMN public.orders.shipping_method IS 'Method of shipping: courier or pickup';

-- Create or update RLS policies if needed
-- (Assuming existing update policies cover these new columns for authenticated users, 
-- but ensuring specific roles can update them is good practice)

-- Allow "production" role to update order_items production fields
DROP POLICY IF EXISTS "Production can update their specific fields" ON public.order_items;
CREATE POLICY "Production can update their specific fields" ON public.order_items
FOR UPDATE
TO authenticated
USING (
  auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role IN ('production', 'admin', 'super_admin'))
)
WITH CHECK (
  auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role IN ('production', 'admin', 'super_admin'))
);

-- Allow "sales" and "dispatch" roles to update dispatch info on orders
DROP POLICY IF EXISTS "Sales and Dispatch can update dispatch info" ON public.orders;
CREATE POLICY "Sales and Dispatch can update dispatch info" ON public.orders
FOR UPDATE
TO authenticated
USING (
  auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role IN ('sales', 'dispatch', 'admin', 'super_admin'))
)
WITH CHECK (
  auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role IN ('sales', 'dispatch', 'admin', 'super_admin'))
);
