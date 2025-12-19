# 🔧 Fix: 401 Unauthorized on Auth Endpoint

## Error

```
POST https://hswgdeldouyclpeqbbgq.supabase.co/auth/v1/token?grant_type=password 401 (Unauthorized)
```

---

## Problem Analysis

Yeh error matlab:
- ✅ API key set hai (request ja rahi hai)
- ❌ Authentication fail ho rahi hai
- Possible causes:
  1. Supabase Auth not enabled
  2. User doesn't exist in Supabase
  3. Wrong credentials
  4. Auth provider not configured

---

## ✅ Solution Steps

### Step 1: Supabase Auth Enable Check Karo

1. **Supabase Dashboard:** https://app.supabase.com/project/hswgdeldouyclpeqbbgq
2. **Authentication** (left sidebar)
3. **Providers** check karo:
   - ✅ **Email** provider enabled hona chahiye
   - ✅ **Password** sign-in enabled hona chahiye

---

### Step 2: Create User in Supabase Auth

1. **Authentication** → **Users** (left sidebar)
2. **Add user** → **Create new user**
3. Add:
   - Email: `hi@chhapai.in` (ya apna email)
   - Password: (set password)
   - Auto Confirm User: ✅ Check (immediate login)
4. **Create user**

---

### Step 3: Verify Environment Variables

Vercel pe check karo:

1. **Settings** → **Environment Variables**
2. Verify:
   - ✅ `VITE_SUPABASE_URL` = `https://hswgdeldouyclpeqbbgq.supabase.co`
   - ✅ `VITE_SUPABASE_ANON_KEY` = (correct anon key)
3. **All environments** selected

---

### Step 4: Test with Correct Credentials

1. https://chhapai.vercel.app open karo
2. Login page pe:
   - Email: Supabase mein create kiye user ka email
   - Password: User ka password
3. Login try karo

---

## 🔍 Check Supabase Auth Settings

### Auth Providers

1. **Authentication** → **Providers**
2. **Email** provider check:
   - ✅ Enabled
   - ✅ "Confirm email" setting (development mein "Off" rakho)

### Auth Settings

1. **Authentication** → **URL Configuration**
2. Check:
   - Site URL: `https://chhapai.vercel.app`
   - Redirect URLs: Add your Vercel URL

---

## ⚠️ Important Notes

1. **User must exist in Supabase Auth** - Firebase users Supabase mein nahi hain automatically
2. **Email provider enabled** - Supabase Auth mein Email provider on hona chahiye
3. **Credentials correct** - Supabase mein create kiye user ka email/password use karo

---

## Quick Test

1. Supabase Dashboard → Authentication → Users
2. User create karo
3. App mein login try karo (same credentials)
4. Should work!

---

**Supabase Auth enable karo aur user create karo! 🚀**

