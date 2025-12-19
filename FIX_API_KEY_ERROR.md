# 🔧 Fix: Invalid API Key Error (401)

## Problem

```
Failed to load resource: the server responded with a status of 401
invalid api key error
```

---

## ✅ Solution Steps

### Step 1: Vercel Environment Variables Check Karo

1. **Vercel Dashboard:** https://vercel.com/dashboard
2. Project **chhapai** → **Settings** → **Environment Variables**
3. Check karo:

**Variable 1:**
```
Name: VITE_SUPABASE_URL
Value: https://hswgdeldouyclpeqbbgq.supabase.co
✅ All environments selected
```

**Variable 2:**
```
Name: VITE_SUPABASE_ANON_KEY
Value: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhzd2dkZWxkb3V5Y2xwZXFiYmdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYxMzU2NjAsImV4cCI6MjA4MTcxMTY2MH0.1Np96vCvDdFy_s2LSneyoorOLUvlpUw2AcAAemX3BnI
✅ All environments selected
```

---

### Step 2: Common Issues Check Karo

❌ **Issue 1: Extra Spaces**
- Key ke aage/peeche space nahi honi chahiye
- Copy-paste mein spaces na aaye

❌ **Issue 2: Missing Variable**
- Dono variables honi chahiye
- `VITE_SUPABASE_ANON_KEY` zaroor check karo

❌ **Issue 3: Wrong Environment**
- Production, Preview, Development - sab select hone chahiye

❌ **Issue 4: Not Redeployed**
- Environment variable add ke baad redeploy zaroori hai

---

### Step 3: Fix Steps

**Option A: Edit Environment Variable**

1. Vercel → Settings → Environment Variables
2. `VITE_SUPABASE_ANON_KEY` pe click
3. Value check karo:
   - No spaces before/after
   - Complete key (full string)
4. **Save**
5. **Redeploy** (important!)

**Option B: Delete & Re-add**

1. Delete `VITE_SUPABASE_ANON_KEY`
2. Add again:
   - Name: `VITE_SUPABASE_ANON_KEY`
   - Value: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhzd2dkZWxkb3V5Y2xwZXFiYmdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYxMzU2NjAsImV4cCI6MjA4MTcxMTY2MH0.1Np96vCvDdFy_s2LSneyoorOLUvlpUw2AcAAemX3BnI`
   - Environments: ✅ Production ✅ Preview ✅ Development
3. **Save**
4. **Redeploy**

---

### Step 4: Redeploy (CRITICAL!)

1. **Deployments** tab
2. Latest deployment → **"..."** → **Redeploy**
3. **Use existing Build Cache** = ❌ Uncheck
4. **Redeploy**
5. Wait 2-3 minutes

---

### Step 5: Verify

1. Live site: https://chhapai.vercel.app
2. **Hard refresh:** Ctrl+Shift+R
3. Browser console check (F12) - 401 error nahi aana chahiye

---

## ✅ Checklist

- [ ] `VITE_SUPABASE_URL` set hai
- [ ] `VITE_SUPABASE_ANON_KEY` set hai (correct value)
- [ ] No spaces in key
- [ ] All environments selected
- [ ] Redeployed after adding variables
- [ ] Build logs check kiye (no errors)

---

**Environment variable correctly add karo aur redeploy karo! 🔧**

