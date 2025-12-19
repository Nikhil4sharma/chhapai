# Firebase to Supabase Migration Status

## ✅ Completed Components

### 1. Database Schema & RLS Policies ✅
**File:** `supabase/migrations/20250120000000_clean_supabase_migration.sql`

**What's Done:**
- ✅ Added `current_department`, `assigned_user`, `is_urgent`, `migration_date` columns to orders
- ✅ Created clean RLS policies with proper visibility logic:
  - Admin sees all orders
  - Sales sees all orders
  - Department users see orders where `current_department = their department`
  - If `assigned_user IS NULL` → all department users see it
  - If `assigned_user IS NOT NULL` → only that user sees it
- ✅ Created helper functions: `is_admin()`, `get_user_department()`, `can_view_order()`
- ✅ Automatic triggers to sync `current_department` from items
- ✅ Automatic `is_urgent` flag updates
- ✅ Indexes for performance

**Next Step:** Run this migration in Supabase Dashboard or via CLI

---

### 2. Firebase User Import Script ✅
**File:** `scripts/migrate-firebase-users.js`
**Package Script:** `npm run migrate-users`

**What's Done:**
- ✅ Migrates users from Firebase Auth to Supabase Auth
- ✅ Migrates profiles from Firestore to Supabase
- ✅ Migrates roles from Firestore to Supabase
- ✅ Handles existing users gracefully
- ✅ Generates temporary passwords (users need to reset)

**Next Step:** 
1. Set up Firebase service account JSON
2. Set `SUPABASE_SERVICE_ROLE_KEY` in environment
3. Run: `npm run migrate-users`

---

### 3. Migration Constants ✅
**File:** `src/constants/migration.ts`

**What's Done:**
- ✅ `MIGRATION_START_DATE` constant (2025-01-20)
- ✅ Helper functions: `isAfterMigrationDate()`, `shouldHandleInSupabase()`

---

### 4. Supabase Service Layer ✅
**File:** `src/services/supabaseOrdersService.ts`

**What's Done:**
- ✅ `fetchAllOrders()` - Fetch orders with RLS filtering
- ✅ `updateOrderItemStage()` - Update item stage
- ✅ `assignOrderItemToDepartment()` - Assign item to department
- ✅ `assignOrderItemToUser()` - Assign item to user
- ✅ `assignOrderToDepartment()` - Order-level department assignment
- ✅ `assignOrderToUser()` - Order-level user assignment
- ✅ `fetchTimelineEntries()` - Fetch timeline
- ✅ `addTimelineEntry()` - Add timeline entry
- ✅ `subscribeToOrdersChanges()` - Realtime subscription for orders
- ✅ `subscribeToOrderItemsChanges()` - Realtime subscription for items
- ✅ Data transformation functions

---

### 5. Documentation ✅
**Files:**
- ✅ `MIGRATION_GUIDE.md` - Complete step-by-step guide
- ✅ `README_MIGRATION.md` - Quick reference
- ✅ `MIGRATION_STATUS.md` - This file

---

## ⏳ Pending Work

### 6. Frontend Migration - OrderContext ⏳
**File:** `src/contexts/OrderContext.tsx` (2600+ lines)

**What Needs to Be Done:**

#### 6.1 Replace Firebase Imports
```typescript
// OLD:
import { collection, doc, getDocs, ... } from 'firebase/firestore';
import { db } from '@/integrations/firebase/config';

// NEW:
import { fetchAllOrders, updateOrderItemStage, ... } from '@/services/supabaseOrdersService';
import { supabase } from '@/integrations/supabase/client';
```

#### 6.2 Replace fetchOrders Function
- Replace Firebase `getDocs()` queries with `fetchAllOrders()`
- Remove Firestore batch queries
- Use Supabase's automatic RLS filtering

#### 6.3 Replace Real-time Listeners
```typescript
// OLD:
const unsubscribe = onSnapshot(ordersQuery, (snapshot) => { ... });

// NEW:
const unsubscribe = subscribeToOrdersChanges((payload) => { ... });
```

#### 6.4 Update All CRUD Operations
- `updateItemStage` → Use `updateOrderItemStage()`
- `assignToDepartment` → Use `assignOrderItemToDepartment()`
- `assignToUser` → Use `assignOrderItemToUser()`
- `addTimelineEntry` → Use `addTimelineEntry()`
- All other Firebase operations → Supabase equivalents

#### 6.5 Simplify Filtering Functions
Since RLS handles filtering, these functions can be simplified:
- `getOrdersByDepartment()` - Can just filter by `is_completed` and `archived_from_wc`
- `getUrgentOrdersForAdmin()` - Filter by `is_urgent` flag
- `getUrgentOrdersForDepartment()` - Filter by `is_urgent` + department

**Status:** Service layer ready, needs integration into OrderContext

---

### 7. Enable Realtime in Supabase ⏳

**Steps:**
1. Go to Supabase Dashboard → Database → Replication
2. Enable Realtime for:
   - `orders` table
   - `order_items` table
   - `timeline` table (or `order_activity`)

**Status:** Manual step, needs to be done in Supabase Dashboard

---

### 8. Testing & Validation ⏳

**Checklist:**
- [ ] Admin sees all orders
- [ ] Sales sees all orders
- [ ] Department users see only their department orders
- [ ] Assigned user sees order when `assigned_user = their id`
- [ ] Other department users don't see assigned orders
- [ ] Orders don't disappear after reload
- [ ] Orders don't disappear after deployment
- [ ] Realtime updates work when order moves departments
- [ ] Realtime updates work when order assigned to user
- [ ] Urgent orders filter correctly
- [ ] Timeline entries show correctly

---

## Migration Steps (In Order)

1. ✅ **Schema Migration** - SQL file created
2. ⏳ **Run Schema Migration** - Execute SQL in Supabase Dashboard
3. ⏳ **Enable Realtime** - Enable in Supabase Dashboard
4. ✅ **User Import Script** - Script ready
5. ⏳ **Import Users** - Run `npm run migrate-users`
6. ✅ **Service Layer** - Supabase service functions ready
7. ⏳ **Frontend Migration** - Update OrderContext to use Supabase
8. ⏳ **Testing** - Test all scenarios
9. ⏳ **Deployment** - Deploy to production

---

## Key Changes Summary

### Database Changes
- **orders.current_department** - Which department owns the order
- **orders.assigned_user** - NULL = all dept users, NOT NULL = only that user
- **orders.is_urgent** - Boolean for urgent filtering
- **RLS Policies** - Automatic filtering based on role and assignment

### Code Changes
- Firebase Firestore → Supabase PostgreSQL
- Firebase Realtime → Supabase Realtime
- Client-side filtering → Server-side RLS filtering
- Batch queries → Single queries with joins

### Benefits
- ✅ Orders never disappear (RLS handles visibility)
- ✅ Better performance (single query vs multiple)
- ✅ Automatic filtering (no client-side logic needed)
- ✅ Realtime updates work reliably
- ✅ No quota limits (Supabase free tier is generous)

---

## Important Notes

1. **Migration Date:** Only orders created after `2025-01-20` are handled in Supabase
2. **Old Firebase Orders:** Read-only, not migrated
3. **User Passwords:** Users need to reset passwords after migration
4. **Realtime:** Must be enabled manually in Supabase Dashboard
5. **RLS Testing:** Test thoroughly with different user roles before production

---

## Next Immediate Steps

1. Run SQL migration in Supabase Dashboard
2. Enable Realtime for orders and order_items tables
3. Test RLS policies with different users
4. Migrate OrderContext to use Supabase service
5. Test thoroughly
6. Deploy

