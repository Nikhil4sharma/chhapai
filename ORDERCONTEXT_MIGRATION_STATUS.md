# OrderContext Migration Status

## ✅ Completed

### 1. Imports Updated ✅
- ✅ Firebase imports replaced with Supabase imports
- ✅ Supabase service functions imported
- ✅ Migration constants imported

### 2. fetchOrders Function ✅
- ✅ Replaced Firebase queries with `fetchAllOrders()` from service
- ✅ Removed complex batch queries
- ✅ RLS automatically handles filtering

### 3. fetchTimeline Function ✅
- ✅ Updated to use Supabase queries
- ✅ Simplified data fetching

### 4. Real-time Listeners ✅
- ✅ Replaced Firebase `onSnapshot` with Supabase subscriptions
- ✅ `subscribeToOrdersChanges()` for orders
- ✅ `subscribeToOrderItemsChanges()` for items
- ✅ Timeline subscription via Supabase channel

### 5. Key CRUD Operations ✅
- ✅ `addTimelineEntry` - Uses `supabaseAddTimelineEntry()`
- ✅ `updateItemStage` - Uses `supabaseUpdateOrderItemStage()`
- ✅ `assignToDepartment` - Uses `assignOrderItemToDepartment()`
- ✅ `assignToUser` - Uses `assignOrderItemToUser()`

---

## ⏳ Remaining Firebase Operations

Following functions still use Firebase and need to be migrated:

### Update Operations
- [ ] `updateItemSubstage` - Update via Supabase
- [ ] `updateItemDeliveryDate` - Update via Supabase
- [ ] `updateOrder` - Update via Supabase
- [ ] `setProductionStageSequence` - Update via Supabase

### File Operations
- [ ] `uploadFile` - Already uses Cloudinary, but Firebase Storage references need removal

### Delete Operations
- [ ] `deleteOrder` - Delete via Supabase (needs batch delete for items, files, timeline)

### Complex Operations
- [ ] `assignToOutsource` - Complex operation with vendor details
- [ ] `sendToProduction` - Update stage sequence
- [ ] `markAsDispatched` - Update dispatch info
- [ ] `updateOutsourceStage` - Update outsource info
- [ ] `vendorDispatch` - Update vendor dispatch
- [ ] `receiveFromVendor` - Update vendor receive
- [ ] `qualityCheck` - Update QC result
- [ ] `postQCDecision` - Post QC decision
- [ ] `addFollowUpNote` - Add follow-up note

### Notification Functions (Firebase-specific)
- [ ] `createNotification` - Needs Supabase notifications table
- [ ] `notifyStageChange` - Uses Firebase user_roles
- [ ] `checkAndNotifyPriority` - Uses Firebase queries

---

## 🔧 Migration Pattern

### For Update Operations:
```typescript
// OLD:
await updateDoc(doc(db, 'order_items', itemId), {
  field: value,
  updated_at: Timestamp.now(),
});

// NEW:
await supabase
  .from('order_items')
  .update({ 
    field: value,
    updated_at: new Date().toISOString(),
  })
  .eq('id', itemId);
```

### For Delete Operations:
```typescript
// OLD:
await deleteDoc(doc(db, 'orders', orderId));

// NEW:
await supabase
  .from('orders')
  .delete()
  .eq('id', orderId);
```

### For Notifications:
Create notifications table in Supabase or use existing notifications system.

---

## 📝 Notes

1. **RLS Handling**: All queries automatically filter based on RLS policies
2. **No Client-side Filtering Needed**: RLS handles department/user filtering
3. **Realtime**: Supabase subscriptions replace Firebase listeners
4. **Timestamps**: Use `new Date().toISOString()` instead of `Timestamp.now()`
5. **User ID**: Use `user.id` (Supabase UUID) instead of `user.uid` (Firebase UID)

---

## ✅ Testing Checklist

After completing migration:
- [ ] Orders load correctly
- [ ] Orders filter by department correctly
- [ ] Real-time updates work
- [ ] Stage updates work
- [ ] Assignments work
- [ ] Files upload correctly
- [ ] Timeline entries show correctly
- [ ] No console errors
- [ ] Orders don't disappear on reload

---

## 🚀 Next Steps

1. Continue migrating remaining Firebase operations
2. Test thoroughly with different user roles
3. Remove Firebase imports that are no longer used
4. Clean up unused Firebase helper functions
5. Update notification system if needed

