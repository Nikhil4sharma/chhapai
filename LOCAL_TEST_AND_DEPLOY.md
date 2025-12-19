# Local Testing & Firebase Deployment Guide

## ✅ Safeguards Implementation Complete

All WooCommerce sync safeguards have been implemented:
- ✅ Order source separation
- ✅ Duplicate prevention
- ✅ Manual orders protection
- ✅ Archive logic (non-destructive)
- ✅ Sync logging
- ✅ Stage-agnostic sync

## 🚀 Step 1: Local Testing

### 1.1 Start Development Server

The dev server should be running at: **http://localhost:8080**

If not running, start it with:
```bash
npm run dev
```

### 1.2 Test Checklist

#### ✅ Basic Functionality
- [ ] Login/Logout works
- [ ] Dashboard loads correctly
- [ ] Orders display properly
- [ ] Can create manual orders
- [ ] Can view order details

#### ✅ WooCommerce Sync (if configured)
- [ ] WooCommerce credentials can be saved
- [ ] Manual sync works
- [ ] No duplicate orders created
- [ ] Manual orders are not affected
- [ ] Archived orders are hidden from Sales view

#### ✅ Workflow Stages
- [ ] Sales → Design transition works
- [ ] Design → Prepress works
- [ ] Prepress → Production works
- [ ] Production → Dispatch works
- [ ] All stages preserve order data

### 1.3 Check Browser Console

Open browser DevTools (F12) and check:
- No critical errors
- No Firebase permission errors
- No CORS errors

## 📝 Step 2: Supabase Migration (If Using WooCommerce Sync)

**Note**: The WooCommerce sync function uses Supabase Edge Functions. If you're using WooCommerce sync, you need to apply the migration to your Supabase database.

### 2.1 Apply Supabase Migration

The migration file is: `supabase/migrations/20251218111755_add_woocommerce_sync_safeguards.sql`

**Option A: Using Supabase Dashboard**
1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy and paste the migration SQL
4. Run the query

**Option B: Using Supabase CLI**
```bash
# If you have Supabase CLI installed
supabase db push
```

### 2.2 Verify Migration

After applying migration, verify these fields exist in `orders` table:
- `archived_from_wc` (boolean)
- `last_seen_in_wc_sync` (timestamp)

And verify `order_sync_logs` table exists.

## 🔥 Step 3: Firebase Deployment

### 3.1 Prerequisites

1. **Firebase CLI installed**:
   ```bash
   npm install -g firebase-tools
   ```

2. **Logged into Firebase**:
   ```bash
   firebase login
   ```

3. **Firebase project configured**:
   - Project ID: `chhapai-order-flow` (already in `.firebaserc`)

### 3.2 Build Project

```bash
npm run build
```

This creates optimized production build in `dist/` folder.

### 3.3 Deploy Firestore & Storage Rules (First Time)

```bash
firebase deploy --only firestore:rules,storage:rules
```

### 3.4 Deploy to Firebase Hosting

```bash
# Option 1: Deploy everything
npm run deploy

# Option 2: Deploy only hosting
npm run deploy:hosting
```

### 3.5 Verify Deployment

After deployment, your app will be available at:
- **Primary URL**: `https://chhapai-order-flow.web.app`
- **Alternative URL**: `https://chhapai-order-flow.firebaseapp.com`

## 🔍 Step 4: Post-Deployment Checks

### 4.1 Test Production App

- [ ] App loads correctly
- [ ] Authentication works
- [ ] Orders display correctly
- [ ] File uploads work
- [ ] All workflows function properly

### 4.2 Monitor Firebase Console

1. **Firebase Console**: https://console.firebase.google.com/project/chhapai-order-flow
2. Check:
   - Hosting: Verify deployment successful
   - Firestore: Check data structure
   - Storage: Verify files uploading
   - Authentication: Check user sign-ins

### 4.3 Check Logs

Monitor for any errors:
- Browser console (F12)
- Firebase Console → Functions (if using Cloud Functions)
- Supabase Dashboard → Edge Functions (if using WooCommerce sync)

## 🛠️ Troubleshooting

### Build Errors

```bash
# Clear cache and rebuild
rm -rf node_modules dist
npm install
npm run build
```

### Firebase Permission Errors

1. Check Firestore rules in `firestore.rules`
2. Check Storage rules in `storage.rules`
3. Verify user authentication is working

### WooCommerce Sync Issues

1. Verify Supabase migration is applied
2. Check Supabase Edge Function is deployed
3. Verify WooCommerce credentials are correct
4. Check sync logs in `order_sync_logs` table (Supabase)

### Port Already in Use

If port 8080 is busy:
```bash
# Kill process on port 8080 (Windows)
netstat -ano | findstr :8080
taskkill /PID <PID> /F

# Or change port in vite.config.ts
```

## 📋 Quick Commands Reference

```bash
# Development
npm run dev              # Start dev server (port 8080)

# Building
npm run build           # Production build
npm run build:dev       # Development build
npm run preview         # Preview production build locally

# Deployment
npm run deploy          # Build + deploy everything
npm run deploy:hosting  # Build + deploy only hosting
npm run deploy:rules    # Deploy only Firestore/Storage rules

# Testing
npm run lint            # Run ESLint
```

## ✅ Success Checklist

Before considering deployment complete:

- [ ] Local testing passed
- [ ] Supabase migration applied (if using WooCommerce)
- [ ] Build completes without errors
- [ ] Firebase rules deployed
- [ ] Hosting deployment successful
- [ ] Production app tested
- [ ] All workflows verified
- [ ] No console errors in production

## 🎉 You're Done!

Once all checks pass, your app is live and ready to use!

---

**Note**: The WooCommerce sync safeguards are now active. All sync operations will:
- ✅ Never delete manual orders
- ✅ Never create duplicates
- ✅ Archive instead of delete
- ✅ Preserve full order history
- ✅ Log all sync operations

