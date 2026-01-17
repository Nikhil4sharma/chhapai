-- Customer Financial System: Opening Balance, Realtime Triggers, Notifications
-- This migration adds comprehensive financial tracking with realtime updates

-- 1. Add opening_balance column to wc_customers
ALTER TABLE wc_customers 
ADD COLUMN IF NOT EXISTS opening_balance NUMERIC DEFAULT 0;

-- 2. Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES wc_customers(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'new_order', 'payment_update', 'status_change'
  title TEXT NOT NULL,
  message TEXT,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for notifications
CREATE POLICY "Users can view their own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- 3. Function to update customer order count (realtime)
CREATE OR REPLACE FUNCTION update_customer_order_count()
RETURNS TRIGGER AS $$
BEGIN
  -- Update order count for the customer
  UPDATE wc_customers
  SET orders_count = (
    SELECT COUNT(*) 
    FROM orders 
    WHERE customer_id = COALESCE(NEW.customer_id, OLD.customer_id)
  )
  WHERE id = COALESCE(NEW.customer_id, OLD.customer_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger for order count update
DROP TRIGGER IF EXISTS trigger_update_order_count ON orders;
CREATE TRIGGER trigger_update_order_count
  AFTER INSERT OR DELETE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_customer_order_count();

-- 4. Function to update customer total_spent (realtime)
CREATE OR REPLACE FUNCTION update_customer_total_spent()
RETURNS TRIGGER AS $$
DECLARE
  v_customer_id UUID;
  v_total_spent NUMERIC;
  v_opening_balance NUMERIC;
BEGIN
  v_customer_id := COALESCE(NEW.customer_id, OLD.customer_id);
  
  -- Get opening balance
  SELECT opening_balance INTO v_opening_balance
  FROM wc_customers
  WHERE id = v_customer_id;
  
  -- Calculate total spent from orders
  SELECT COALESCE(SUM(total_amount), 0) INTO v_total_spent
  FROM orders
  WHERE customer_id = v_customer_id;
  
  -- Update customer record
  UPDATE wc_customers
  SET 
    total_spent = (COALESCE(v_opening_balance, 0) + v_total_spent)::text
  WHERE id = v_customer_id;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger for total_spent update
DROP TRIGGER IF EXISTS trigger_update_total_spent ON orders;
CREATE TRIGGER trigger_update_total_spent
  AFTER INSERT OR UPDATE OR DELETE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_customer_total_spent();

-- 5. Function to create notification on new order
CREATE OR REPLACE FUNCTION notify_on_new_order()
RETURNS TRIGGER AS $$
DECLARE
  v_customer_name TEXT;
  v_assigned_user UUID;
BEGIN
  -- Get customer name and assigned user
  SELECT 
    COALESCE(first_name || ' ' || last_name, email),
    assigned_to
  INTO v_customer_name, v_assigned_user
  FROM wc_customers
  WHERE id = NEW.customer_id;
  
  -- Create notification for assigned sales manager
  IF v_assigned_user IS NOT NULL THEN
    INSERT INTO notifications (user_id, customer_id, order_id, type, title, message)
    VALUES (
      v_assigned_user,
      NEW.customer_id,
      NEW.id,
      'new_order',
      'New Order Imported',
      'Order #' || COALESCE(NEW.wc_order_number, NEW.id::text) || ' for ' || v_customer_name
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for new order notification
DROP TRIGGER IF EXISTS trigger_notify_new_order ON orders;
CREATE TRIGGER trigger_notify_new_order
  AFTER INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION notify_on_new_order();

-- 6. Function to notify on payment update
CREATE OR REPLACE FUNCTION notify_on_payment_update()
RETURNS TRIGGER AS $$
DECLARE
  v_customer_name TEXT;
  v_assigned_user UUID;
  v_customer_id UUID;
BEGIN
  -- Get customer info from wc_customers
  SELECT 
    wc.id,
    COALESCE(wc.first_name || ' ' || wc.last_name, wc.email),
    wc.assigned_to
  INTO v_customer_id, v_customer_name, v_assigned_user
  FROM wc_customers wc
  WHERE wc.id = NEW.customer_id;
  
  -- Create notification for assigned sales manager
  IF v_assigned_user IS NOT NULL THEN
    INSERT INTO notifications (user_id, customer_id, type, title, message)
    VALUES (
      v_assigned_user,
      v_customer_id,
      'payment_update',
      'Payment Received',
      'Payment of ₹' || NEW.amount || ' received from ' || v_customer_name
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for payment notification
DROP TRIGGER IF EXISTS trigger_notify_payment ON payment_ledger;
CREATE TRIGGER trigger_notify_payment
  AFTER INSERT ON payment_ledger
  FOR EACH ROW
  WHEN (NEW.transaction_type = 'CREDIT')
  EXECUTE FUNCTION notify_on_payment_update();

-- 7. Grant permissions
GRANT SELECT, INSERT, UPDATE ON notifications TO authenticated;
GRANT EXECUTE ON FUNCTION update_customer_order_count TO authenticated;
GRANT EXECUTE ON FUNCTION update_customer_total_spent TO authenticated;
GRANT EXECUTE ON FUNCTION notify_on_new_order TO authenticated;
GRANT EXECUTE ON FUNCTION notify_on_payment_update TO authenticated;

-- 8. Create helper function to get customer stats (for frontend)
CREATE OR REPLACE FUNCTION get_customer_stats(p_customer_id UUID)
RETURNS TABLE (
  total_paid NUMERIC,
  total_spent NUMERIC,
  balance NUMERIC,
  orders_count INTEGER,
  opening_balance NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(SUM(CASE WHEN pl.transaction_type = 'CREDIT' THEN pl.amount ELSE 0 END), 0) as total_paid,
    (wc.opening_balance + COALESCE(SUM(o.total_amount), 0))::NUMERIC as total_spent,
    (COALESCE(SUM(CASE WHEN pl.transaction_type = 'CREDIT' THEN pl.amount ELSE 0 END), 0) - 
     (wc.opening_balance + COALESCE(SUM(o.total_amount), 0)))::NUMERIC as balance,
    wc.orders_count::INTEGER,
    wc.opening_balance
  FROM wc_customers wc
  LEFT JOIN payment_ledger pl ON pl.customer_id = wc.id
  LEFT JOIN orders o ON o.customer_id = wc.id
  WHERE wc.id = p_customer_id
  GROUP BY wc.id, wc.opening_balance, wc.orders_count;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION get_customer_stats TO authenticated;
