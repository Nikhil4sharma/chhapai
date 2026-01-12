-- Rename 'in_production' to 'production_in_progress' in orders and order_items

UPDATE orders 
SET order_status = 'production_in_progress' 
WHERE order_status = 'in_production';

UPDATE order_items 
SET status = 'production_in_progress' 
WHERE status = 'in_production';
