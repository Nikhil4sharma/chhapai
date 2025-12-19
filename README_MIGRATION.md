# Supabase Migration - Quick Reference

## Migration Status

✅ **Schema Migration** - SQL migration file ready: `supabase/migrations/20250120000000_clean_supabase_migration.sql`
✅ **User Import Script** - Ready: `scripts/migrate-firebase-users.js`
✅ **Migration Constants** - Created: `src/constants/migration.ts`
⏳ **Frontend Migration** - In progress (OrderContext needs Supabase queries)

## Key Concepts

### RLS Policy Logic

1. **Admin** - Sees ALL orders (no restrictions)

2. **Sales** - Sees ALL orders (legacy behavior for full visibility)

3. **Department Users** (design, prepress, production):
   - See orders where `orders.current_department = their department`
   - If `orders.assigned_user IS NULL` → ALL users in that department see it
   - If `orders.assigned_user IS NOT NULL` → ONLY that specific user sees it

### Order Visibility Flow

```
User tries to view order
  ↓
Is user admin? → YES → Allow
  ↓ NO
Is user sales? → YES → Allow
  ↓ NO
Check order.current_department = user.department?
  ↓ NO → Deny
  ↓ YES
Check order.assigned_user
  ↓ NULL → Allow (all department users)
  ↓ NOT NULL → Check if assigned_user = user.id
    ↓ YES → Allow
    ↓ NO → Deny
```

### Schema Changes

**orders table new columns:**
- `current_department` TEXT - Which department currently owns this order
- `assigned_user` UUID (nullable) - Specific user assignment (NULL = all dept users)
- `is_urgent` BOOLEAN - Flag for urgent orders (priority = red)
- `migration_date` TIMESTAMP - When order was created in Supabase

**Automatic Sync:**
- `orders.current_department` automatically synced from `order_items.assigned_department`
- `orders.is_urgent` automatically updated when item priorities change

## Migration Steps

1. **Run SQL Migration**
   ```bash
   # Apply migration via Supabase Dashboard or CLI
   ```

2. **Enable Realtime** (Supabase Dashboard → Database → Replication)
   - Enable for `orders` table
   - Enable for `order_activity` (or `timeline`) table

3. **Import Firebase Users**
   ```bash
   npm run migrate-users
   ```

4. **Update Frontend**
   - Migrate `OrderContext.tsx` to use Supabase queries
   - Remove Firebase listeners
   - Use Supabase Realtime subscriptions

## Testing Checklist

- [ ] Admin sees all orders
- [ ] Sales sees all orders  
- [ ] Department user sees orders in their department
- [ ] Assigned user sees order when assigned_user = their id
- [ ] Other department users don't see assigned orders
- [ ] Realtime updates work when order moves departments
- [ ] Orders don't disappear after reload
- [ ] Orders don't disappear after deployment

## Troubleshooting

**Orders disappearing:**
- Check RLS policies applied correctly
- Check `current_department` is set on orders
- Check Supabase logs for RLS errors

**Realtime not working:**
- Verify Realtime enabled in Supabase Dashboard
- Check WebSocket connection in browser console
- Verify subscription is active

**RLS blocking access:**
- Check user has correct role in `user_roles` table
- Check `get_user_department()` returns correct department
- Check `can_view_order()` function logic

