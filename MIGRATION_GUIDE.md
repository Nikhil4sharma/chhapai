# Firebase to Supabase Migration Guide

## Overview

Yeh migration guide Firebase se Supabase migrate karne ke liye complete instructions deti hai. Migration ke baad:
- Firebase READ-ONLY ho jayega (kuch bhi write nahi hoga)
- Sirf orders jo aaj se create honge wo Supabase mein handle honge
- Purane Firebase orders ignore kiye jayenge

## Step 1: Supabase Schema Migration

### 1.1 Supabase Migration File Run Karein

```bash
# Supabase local development ke liye
supabase migration up

# Ya phir Supabase dashboard se manually run karein:
# 1. Supabase Dashboard → Database → Migrations
# 2. New migration file upload karein: supabase/migrations/20250120000000_clean_supabase_migration.sql
```

Ye migration:
- `current_department`, `assigned_user`, `is_urgent` columns add karega orders table mein
- Clean RLS policies setup karega
- Realtime enable karega (manually dashboard se)
- Helper functions create karega

### 1.2 Realtime Enable Karein (Supabase Dashboard)

1. Supabase Dashboard → Database → Replication
2. Enable Realtime for:
   - `orders` table
   - `order_activity` table (ya `timeline` table)

## Step 2: Firebase User Import

### 2.1 Install Firebase Admin SDK

```bash
npm install firebase-admin
```

### 2.2 Firebase Service Account Setup

1. Firebase Console → Project Settings → Service Accounts
2. "Generate new private key" click karein
3. JSON file download karein
4. File ko project root mein save karein as `firebase-service-account.json` (ya kisi secure location mein)

### 2.2 Environment Variables Setup

`.env` file mein add karein:

```env
FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json
SUPABASE_URL=https://hswgdeldouyclpeqbbgq.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

**Important:** `SUPABASE_SERVICE_ROLE_KEY` Supabase Dashboard → Settings → API → service_role key se milta hai.

### 2.3 Migration Script Run Karein

```bash
node scripts/migrate-firebase-users.js
```

Ye script:
- Firebase Auth se saare users fetch karega
- Firestore se profiles aur roles fetch karega
- Supabase Auth mein users create karega (same email, new UUID)
- `public.profiles` table mein profiles insert karega
- `public.user_roles` table mein roles insert karega

### 2.4 User Password Reset

**Important:** Migrated users ko password reset karna padega kyunki:
- Firebase passwords migrate nahi ho sakte (security reasons)
- Temporary passwords generate kiye gaye hain

Users ko batayein ki "Forgot Password" feature use karein to set new password.

## Step 3: Frontend Code Updates

### 3.1 Migration Constants

`src/constants/migration.ts` file already create ho chuki hai with `MIGRATION_START_DATE`.

### 3.2 OrderContext Migration

`src/contexts/OrderContext.tsx` ko Supabase queries mein migrate karna hoga. Yeh complex task hai, detailed instructions next section mein.

## Step 4: RLS Policies Verification

### 4.1 Test Admin Access

1. Admin user se login karein
2. Dashboard pe saare orders dikhne chahiye
3. Different departments ke orders dikhne chahiye

### 4.2 Test Department Access

1. Sales user se login karein
2. Sirf sales department ke orders dikhne chahiye
3. Admin orders nahi dikhne chahiye (unless assigned)

### 4.3 Test User Assignment

1. Ek order ko specific user ko assign karein
2. Sirf assigned user ko woh order dikhna chahiye
3. Department ke baaki users ko nahi dikhna chahiye

### 4.4 Test Realtime Updates

1. Ek order ko different department mein move karein
2. Realtime mein instantly update hona chahiye
3. Previous department se order disappear hona chahiye

## Step 5: Cleanup

### 5.1 Firebase Code Removal (Optional)

Frontend se Firebase code remove karein (agar fully migrate ho gaya):
- `src/integrations/firebase/` directory
- Firebase imports from `OrderContext.tsx`
- Firebase config files

**Note:** Abhi Firebase READ-ONLY hai, to reference ke liye rakha ja sakta hai.

## Troubleshooting

### Users migrate nahi ho rahe

1. Check `SUPABASE_SERVICE_ROLE_KEY` correct hai
2. Check Firebase service account JSON file path correct hai
3. Check Supabase project URL correct hai
4. Check user email already exist to nahi karta Supabase mein

### Orders disappear ho rahe hain

1. Check RLS policies correctly applied hain
2. Check `current_department` correctly set hai
3. Check `assigned_user` logic sahi hai
4. Check Supabase logs for RLS policy errors

### Realtime kaam nahi kar raha

1. Check Realtime enabled hai Supabase Dashboard se
2. Check WebSocket connection properly established hai
3. Check browser console for errors
4. Check Supabase project quota exhausted to nahi

## Key Changes Summary

1. **Schema Changes:**
   - `orders.current_department` - Department that owns order
   - `orders.assigned_user` - NULL = all department users, NOT NULL = only that user
   - `orders.is_urgent` - Boolean for urgent orders
   - `orders.migration_date` - Track when order created in Supabase

2. **RLS Policy Logic:**
   - Admin sees all orders
   - Department users see orders where `current_department = their department`
   - If `assigned_user IS NULL` → all department users see it
   - If `assigned_user IS NOT NULL` → only that user sees it

3. **Realtime:**
   - Orders table pe Realtime enabled
   - Order activity table pe Realtime enabled
   - Instant updates across departments

## Support

Agar koi issue aaye to check karein:
- Supabase Dashboard → Logs
- Browser Console → Errors
- Network tab → Failed requests

