-- Add customer_id to orders table to link with wc_customers
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES wc_customers(id);

CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);

-- Optional: If you want to backfill existing orders based on email?
-- UPDATE orders o
-- SET customer_id = c.id
-- FROM wc_customers c
-- WHERE o.customer_email = c.email AND o.customer_id IS NULL;
