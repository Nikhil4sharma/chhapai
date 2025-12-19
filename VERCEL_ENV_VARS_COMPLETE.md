# ✅ Vercel Environment Variables - Complete Guide

## Step 1: Supabase API Keys Copy Karo

### Current Page:
`https://app.supabase.com/project/hswgdeldouyclpeqbbgq/settings/api`

### 1. VITE_SUPABASE_URL ✅

**Project URL** section se:
```
https://hswgdeldouyclpeqbbgq.supabase.co
```
Copy karo ✅

### 2. VITE_SUPABASE_ANON_KEY 🔑

**Same page pe neeche "API Keys" section:**
- **"anon public"** key dikhega
- Long string (eyJ... se start)
- Copy button click karo

---

## Step 2: Vercel pe Add Karo

1. **Vercel Dashboard:** https://vercel.com/dashboard
2. Project **chhapai** select
3. **Settings** → **Environment Variables**
4. **Add** button click

### Variable 1:
```
Name: VITE_SUPABASE_URL
Value: https://hswgdeldouyclpeqbbgq.supabase.co
Environment: ✅ Production ✅ Preview ✅ Development
```

### Variable 2:
```
Name: VITE_SUPABASE_ANON_KEY
Value: (API Keys section se "anon public" key paste karo)
Environment: ✅ Production ✅ Preview ✅ Development
```

5. **Save** click

---

## Step 3: Redeploy

1. **Deployments** tab
2. Latest deployment → **"..."** → **Redeploy**
3. Wait 2-3 minutes

---

## ✅ Done!

Environment variables add karne ke baad redeploy karo, phir app work karega!

---

**API Keys section mein "anon public" key copy karo aur Vercel pe add karo! 🚀**

