# Supabase SQL Queries - Reference Guide

Yeh document me aapke Supabase database ke liye useful SQL queries hain. Agar koi specific operation karna ho ya data check karna ho, toh yeh queries use kar sakte hain.

## Important Notes

- **CASCADE DELETE**: Orders delete karne se automatically related items, files, aur timeline entries bhi delete ho jayenge (database me CASCADE setup hai)
- **RLS (Row Level Security)**: Sab tables me RLS enabled hai, isliye users sirf apne allowed data hi dekh sakte hain
- **Admin Access**: Admin users ko sab tables me full access hai

## Common Queries

### 1. Team Members (Profiles + Roles)

```sql
-- Sab team members dekhne ke liye
SELECT 
  p.id,
  p.user_id,
  p.full_name,
  p.department,
  p.phone,
  p.avatar_url,
  p.created_at,
  array_agg(ur.role) as roles
FROM profiles p
LEFT JOIN user_roles ur ON p.user_id = ur.user_id
GROUP BY p.id, p.user_id, p.full_name, p.department, p.phone, p.avatar_url, p.created_at
ORDER BY p.full_name;
```

### 2. Orders Check

```sql
-- Sab active orders dekhne ke liye
SELECT 
  o.id,
  o.order_id,
  o.customer_name,
  o.source,
  o.is_completed,
  o.priority,
  o.delivery_date,
  o.created_at,
  COUNT(oi.id) as item_count
FROM orders o
LEFT JOIN order_items oi ON o.id = oi.order_id
WHERE o.is_completed = false
  AND o.archived_from_wc = false
GROUP BY o.id, o.order_id, o.customer_name, o.source, o.is_completed, o.priority, o.delivery_date, o.created_at
ORDER BY o.created_at DESC;
```

### 3. Order Items by Department

```sql
-- Kisi specific department ke items dekhne ke liye
SELECT 
  oi.id,
  oi.order_id,
  o.order_id as order_number,
  oi.product_name,
  oi.assigned_department,
  oi.current_stage,
  oi.assigned_to,
  p.full_name as assigned_to_name,
  oi.priority,
  oi.delivery_date
FROM order_items oi
JOIN orders o ON oi.order_id = o.id
LEFT JOIN profiles p ON oi.assigned_to = p.user_id
WHERE oi.assigned_department = 'design'  -- Change department name here
  AND o.is_completed = false
ORDER BY oi.priority DESC, oi.delivery_date ASC;
```

### 4. Timeline Entries

```sql
-- Kisi order ki timeline dekhne ke liye
SELECT 
  t.id,
  t.order_id,
  o.order_id as order_number,
  t.stage,
  t.action,
  t.performed_by_name,
  t.notes,
  t.created_at
FROM timeline t
JOIN orders o ON t.order_id = o.id
WHERE o.order_id = 'MAN-123'  -- Order number yahan dalo
ORDER BY t.created_at DESC;
```

### 5. User Work Logs

```sql
-- Kisi user ke work logs dekhne ke liye
SELECT 
  wl.log_id,
  wl.user_name,
  wl.department,
  wl.order_number,
  wl.stage,
  wl.action_type,
  wl.work_summary,
  wl.time_spent_minutes,
  wl.work_date
FROM user_work_logs wl
WHERE wl.user_id = 'user-uuid-here'  -- User ID yahan dalo
ORDER BY wl.work_date DESC, wl.created_at DESC;
```

### 6. Notifications

```sql
-- Kisi user ki unread notifications
SELECT 
  n.id,
  n.title,
  n.message,
  n.type,
  n.order_id,
  n.created_at
FROM notifications n
WHERE n.user_id = 'user-uuid-here'  -- User ID yahan dalo
  AND n.is_read = false
ORDER BY n.created_at DESC;
```

## Admin Queries

### 7. Delete Order (CASCADE will handle related data)

```sql
-- Order delete karne ke liye (Admin only)
-- WARNING: Ye permanently delete karega order aur sab related data
DELETE FROM orders
WHERE order_id = 'MAN-123';  -- Order number yahan dalo
-- Note: Items, files, timeline automatically delete ho jayenge (CASCADE)
```

### 8. Update User Role

```sql
-- User ka role update karne ke liye
UPDATE user_roles
SET role = 'admin'::app_role  -- Role yahan dalo: admin, sales, design, prepress, production
WHERE user_id = 'user-uuid-here';
```

### 9. Assign Order Item to Department

```sql
-- Order item ko department assign karne ke liye
UPDATE order_items
SET 
  assigned_department = 'design',  -- Department yahan dalo
  current_stage = 'design',
  updated_at = now()
WHERE id = 'item-uuid-here';
```

### 10. Complete Order

```sql
-- Order ko complete mark karne ke liye
UPDATE orders
SET 
  is_completed = true,
  updated_at = now()
WHERE order_id = 'MAN-123';
```

## Utility Queries

### 11. Check Database Size

```sql
-- Database size check karne ke liye
SELECT 
  pg_size_pretty(pg_database_size(current_database())) as database_size;
```

### 12. Count Records

```sql
-- Tables me records count karne ke liye
SELECT 
  'orders' as table_name, COUNT(*) as count FROM orders
UNION ALL
SELECT 'order_items', COUNT(*) FROM order_items
UNION ALL
SELECT 'profiles', COUNT(*) FROM profiles
UNION ALL
SELECT 'user_roles', COUNT(*) FROM user_roles
UNION ALL
SELECT 'timeline', COUNT(*) FROM timeline
UNION ALL
SELECT 'notifications', COUNT(*) FROM notifications;
```

### 13. Find Duplicate Orders

```sql
-- Duplicate order numbers check karne ke liye
SELECT 
  order_id, 
  COUNT(*) as count
FROM orders
GROUP BY order_id
HAVING COUNT(*) > 1;
```

## Important Functions

Database me yeh helper functions already available hain:

1. **has_role(user_id, role)**: Check karta hai ki user ke paas specific role hai ya nahi
2. **get_user_department(user_id)**: User ka department return karta hai

Example:
```sql
-- Check if user is admin
SELECT has_role('user-uuid', 'admin'::app_role);

-- Get user department
SELECT get_user_department('user-uuid');
```

## Notes

- Agar koi query run karte waqt permission error aaye, toh check karo ki aap admin user se login hain ya nahi
- RLS policies ke wajah se normal users sirf apne allowed data hi dekh sakte hain
- Orders delete karte waqt careful raho - CASCADE delete automatically related data bhi delete kar dega

## Support

Agar koi specific query chahiye ho ya koi issue ho, toh Supabase dashboard me SQL Editor use karo ya migration files check karo `supabase/migrations/` folder me.

