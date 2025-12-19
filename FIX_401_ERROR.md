# 🔧 Fix 401 Invalid API Key Error

## Problem

Console mein 401 error:
```
Failed to load resource: the server responded with a status of 401
invalid api key
```

---

## ✅ Solution: Vercel Environment Variables Fix

### Step 1: Vercel Dashboard Pe Jao

1. **Vercel Dashboard:** https://vercel.com/dashboard
2. Project **chhapai** select
3. **Settings** → **Environment Variables**

### Step 2: Delete Old Key (If Wrong)

1. `VITE_SUPABASE_ANON_KEY` find karo
2. **Delete** karo (agar wrong value hai)

### Step 3: Add Correct Key

**New Variable Add:**

```
Name: VITE_SUPABASE_ANON_KEY
Value: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhzd2dkZWxkb3V5Y2xwZXFiYmdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYxMzU2NjAsImV4cCI6MjA4MTcxMTY2MH0.1Np96vCvDdFy_s2LSneyoorOLUvlpUw2AcAAemX3BnI
Environment: ✅ Production ✅ Preview ✅ Development (ALL SELECT KARO!)
```

**Important:**
- ✅ No spaces before/after value
- ✅ Complete key (full string)
- ✅ All 3 environments select karo

### Step 4: Also Add URL (If Missing)

```
Name: VITE_SUPABASE_URL
Value: https://hswgdeldouyclpeqbbgq.supabase.co
Environment: ✅ Production ✅ Preview ✅ Development
```

### Step 5: REDEPLOY (CRITICAL!)

1. **Deployments** tab
2. Latest deployment → **"..."** (three dots)
3. **Redeploy** click
4. **Use existing Build Cache** = ❌ UNCHECK (fresh build)
5. **Redeploy** confirm
6. Wait 2-3 minutes

---

## 🔍 Verify

1. Deployment complete hone ke baad
2. https://chhapai.vercel.app open karo
3. **Hard refresh:** Ctrl+Shift+R
4. Browser console (F12) - 401 error nahi aana chahiye

---

## ⚠️ Common Mistakes

❌ **Space in key** - Key ke aage/peeche space nahi honi chahiye
❌ **Not redeployed** - Environment variable add ke baad redeploy MUST hai
❌ **Wrong environment** - All environments (Production, Preview, Development) select karo
❌ **Incomplete key** - Full key copy-paste karo

---

**Environment variable correctly add karo aur redeploy karo! 401 error fix ho jayega! ✅**

