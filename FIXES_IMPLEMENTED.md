# Fixes Implemented - Tab Switch Reload & Activity Logging

## ✅ Issue 1: Tab Switch Reload Fix

### Changes Made:

1. **AuthContext.tsx** - Prevented unnecessary profile refetch on token refresh:
   - Added check to ignore `TOKEN_REFRESHED` events when user data is already loaded
   - This prevents full reload when tab regains focus

2. **OrderContext.tsx** - Added visibility change handler:
   - Added `handleVisibilityChange` listener to prevent refetch on tab switch
   - Only refreshes data if cache is stale (older than 5 minutes)
   - Preserves UI state when switching tabs

### How It Works:
- When tab is hidden, state is preserved
- When tab becomes visible, only refreshes if data is stale
- No full-page loader on tab refocus
- Session and order data persist across tab switches

---

## ✅ Issue 2: Activity Logging System

### Changes Made:

1. **Migration Created** (`20251221000000_create_order_activity_logs.sql`):
   - Created `order_activity_logs` table with:
     - `department` column (sales, design, prepress, production, dispatch)
     - `action` column (created, assigned, started, completed, etc.)
     - `message` column (human-readable activity description)
     - Proper indexes and RLS policies
   - Enabled realtime subscriptions

2. **Service Layer** (`supabaseOrdersService.ts`):
   - Added `addActivityLog()` function
   - Handles UUID conversion for order_id and item_id
   - Non-blocking (doesn't throw errors)

3. **OrderContext.tsx**:
   - Added `logActivity()` helper function
   - Updated `updateItemStage()` to log activities
   - Activity logs are written BEFORE timeline entries

### Next Steps Needed:

1. **Activity Log Fetching**:
   - Add function to fetch activity logs from `order_activity_logs` table
   - Merge with timeline entries in `getTimelineForOrder()`

2. **Department-wise Timeline UI**:
   - Create new `DepartmentTimeline` component
   - Group activities by department
   - Make each department section collapsible
   - Show latest activity expanded by default
   - Chronological ordering within each department

3. **Add Activity Logging to More Functions**:
   - `assignToDepartment()` - log department assignment
   - `markAsDispatched()` - log dispatch
   - `assignToUser()` - log user assignment
   - `uploadFile()` - log file upload
   - `addNote()` - log note addition
   - All other state-changing operations

4. **Real-time Subscription**:
   - Add subscription for `order_activity_logs` table changes
   - Update timeline in real-time when activities are logged

---

## Testing Checklist

- [ ] Test tab switch - should NOT reload or show blank screen
- [ ] Test activity logs are written on stage changes
- [ ] Test department-wise timeline grouping
- [ ] Test timeline collapsible sections
- [ ] Test real-time updates for activity logs
- [ ] Test timeline shows correct department for each activity

