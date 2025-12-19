# ⚡ Quick Deployment Guide

## 🚀 3 Steps to Deploy

### Step 1: Supabase SQL Migration (2 minutes)

1. Go to: https://app.supabase.com/project/hswgdeldouyclpeqbbgq/sql/new
2. Copy content from: `supabase/migrations/20250120000000_clean_supabase_migration.sql`
3. Paste and click **Run**
4. ✅ Success check karo

### Step 2: Enable Realtime (1 minute)

1. Go to: https://app.supabase.com/project/hswgdeldouyclpeqbbgq/database/replication
2. Enable Realtime for:
   - ✅ `orders`
   - ✅ `order_items`
   - ✅ `timeline`

### Step 3: Vercel Environment Variables (2 minutes)

1. Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add these:

```
VITE_SUPABASE_URL = https://hswgdeldouyclpeqbbgq.supabase.co
VITE_SUPABASE_ANON_KEY = (Supabase Dashboard → Settings → API → anon/public key)
```

3. **Save** and **Redeploy**

---

## 📋 Supabase API Key Kaha Se Milega?

1. Supabase Dashboard: https://app.supabase.com/project/hswgdeldouyclpeqbbgq
2. Left sidebar → **Settings** → **API**
3. Copy **anon public** key (yeh `VITE_SUPABASE_ANON_KEY` hai)

---

## ✅ Done!

GitHub push karo → Vercel auto-deploy → Live URL mil jayega!

---

## 🐛 Error Aaye To?

### "supabaseKey is required"
- Vercel mein environment variable add karo
- Redeploy karo

### "RLS policy violation"  
- SQL migration run karo (Step 1)

### "Realtime not working"
- Replication enable karo (Step 2)

