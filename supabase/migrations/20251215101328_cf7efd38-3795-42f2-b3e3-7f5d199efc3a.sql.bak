-- Add new columns for comprehensive WooCommerce data
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS shipping_name text,
ADD COLUMN IF NOT EXISTS shipping_email text,
ADD COLUMN IF NOT EXISTS shipping_phone text,
ADD COLUMN IF NOT EXISTS shipping_address text,
ADD COLUMN IF NOT EXISTS shipping_city text,
ADD COLUMN IF NOT EXISTS shipping_state text,
ADD COLUMN IF NOT EXISTS shipping_pincode text,
ADD COLUMN IF NOT EXISTS billing_city text,
ADD COLUMN IF NOT EXISTS billing_state text,
ADD COLUMN IF NOT EXISTS billing_pincode text,
ADD COLUMN IF NOT EXISTS order_status text,
ADD COLUMN IF NOT EXISTS payment_status text,
ADD COLUMN IF NOT EXISTS order_total numeric,
ADD COLUMN IF NOT EXISTS tax_cgst numeric,
ADD COLUMN IF NOT EXISTS tax_sgst numeric,
ADD COLUMN IF NOT EXISTS woo_order_id integer;

-- Add line_total to order_items for product pricing
ALTER TABLE public.order_items 
ADD COLUMN IF NOT EXISTS line_total numeric,
ADD COLUMN IF NOT EXISTS woo_meta jsonb DEFAULT '[]'::jsonb;