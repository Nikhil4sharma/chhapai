# 🚀 Vercel Deploy - Complete Steps

## Step 1: GitHub Push (Manual)

Agar git push mein issue aaye to:

```bash
# Try karo
git push origin main

# Ya force push (agar needed ho)
git push -f origin main

# Ya remote check karo
git remote set-url origin https://github.com/Nikhil4sharma/chhapai.git
git push origin main
```

**Ya manually GitHub pe upload karo:**
1. GitHub.com → Your repo
2. Files manually upload karo
3. Commit message: "Supabase migration complete"

---

## Step 2: Vercel Dashboard Setup

### A. Vercel Account

1. **Vercel.com** jao: https://vercel.com
2. **Sign Up** (GitHub account se - easy)
3. Login karo

### B. Import Project

1. Vercel Dashboard → **Add New Project**
2. **Import Git Repository** click
3. GitHub repo select: **Nikhil4sharma/chhapai**
4. **Import** click

### C. Project Configuration

**Project Name:** chhapai (ya apna naam)
**Framework Preset:** Vite (auto-detect ho jayega)
**Root Directory:** `./` (default)
**Build Command:** `npm run build` (default)
**Output Directory:** `dist` (default)

### D. Environment Variables (CRITICAL!)

**Deploy se PEHLE add karo:**

1. **Environment Variables** section mein jao
2. Add karo:

**Variable 1:**
- Key: `VITE_SUPABASE_URL`
- Value: `https://hswgdeldouyclpeqbbgq.supabase.co`
- Environment: ✅ Production, ✅ Preview, ✅ Development

**Variable 2:**
- Key: `VITE_SUPABASE_ANON_KEY`
- Value: *(Supabase Dashboard se - neeche instructions)*
- Environment: ✅ Production, ✅ Preview, ✅ Development

**Supabase API Key:**
1. https://app.supabase.com/project/hswgdeldouyclpeqbbgq
2. Left sidebar → **Settings** → **API**
3. **anon public** key copy karo
4. Yeh `VITE_SUPABASE_ANON_KEY` hai

3. **Save** click

### E. Deploy

1. **Deploy** button click
2. Wait (2-3 minutes)
3. ✅ **Deployment URL** milega!

---

## Step 3: Supabase Setup (Pehle Kar Lena Better)

### SQL Migration

1. https://app.supabase.com/project/hswgdeldouyclpeqbbgq/sql/new
2. File: `supabase/migrations/20250120000000_clean_supabase_migration.sql`
3. Copy-paste → **Run**

### Realtime

1. https://app.supabase.com/project/hswgdeldouyclpeqbbgq/database/replication
2. Enable: `orders`, `order_items`, `timeline`

---

## ✅ After Deployment

**Live URL** mil jayega:
- Example: `https://chhapai.vercel.app`
- Ya: `https://chhapai-abc123.vercel.app`

URL open karo → Test karo → Done! 🎉

---

## 🐛 Issues?

### Repository Not Found
- GitHub repo public hai? Private repo ke liye Vercel ko access dena padega
- Repository name check karo

### Build Fails
- Environment variables add ki?
- Vercel logs check karo

### supabaseKey Error
- Environment variables Vercel mein add ki?
- Redeploy karo

---

**Ready to Deploy! 🚀**

