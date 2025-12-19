# 🚀 Deployment Guide - GitHub + Vercel

## ✅ Pre-Deployment Checklist

### 1. Supabase Setup

#### Step 1: Supabase Dashboard mein SQL Migration Run Karein

1. **Supabase Dashboard** kholo: https://app.supabase.com/project/hswgdeldouyclpeqbbgq
2. **SQL Editor** mein jao (left sidebar)
3. **New Query** click karo
4. Ye file copy-paste karo: `supabase/migrations/20250120000000_clean_supabase_migration.sql`
5. **Run** button click karo
6. ✅ Success message check karo

#### Step 2: Realtime Enable Karein

1. Supabase Dashboard → **Database** → **Replication**
2. Enable Realtime for:
   - ✅ `orders` table
   - ✅ `order_items` table  
   - ✅ `timeline` table

#### Step 3: API Keys Copy Karein

1. Supabase Dashboard → **Settings** → **API**
2. Copy karo:
   - **Project URL** (already hai: `https://hswgdeldouyclpeqbbgq.supabase.co`)
   - **anon/public key** (yeh `VITE_SUPABASE_ANON_KEY` hai)

---

### 2. Environment Variables Setup

#### Local Development (.env file)

1. Project root mein `.env` file banayo (agar nahi hai)
2. Add karo:

```env
VITE_SUPABASE_URL=https://hswgdeldouyclpeqbbgq.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-from-supabase-dashboard
```

#### Vercel Deployment (Environment Variables)

1. Vercel Dashboard → Your Project → **Settings** → **Environment Variables**
2. Add karo:

```
VITE_SUPABASE_URL = https://hswgdeldouyclpeqbbgq.supabase.co
VITE_SUPABASE_ANON_KEY = your-anon-key-here
```

**Important:** 
- Production, Preview, Development sab environments mein add karo
- Redeploy karo after adding environment variables

---

### 3. GitHub Push

```bash
# Git status check karo
git status

# All changes add karo
git add .

# Commit karo
git commit -m "Migrate to Supabase - Ready for deployment"

# Push karo
git push origin main
```

---

### 4. Vercel Auto-Deploy

1. GitHub repo ko Vercel se connect karo (agar nahi hai)
   - Vercel Dashboard → **Add New Project**
   - GitHub repo select karo
   - **Import** click karo

2. **Environment Variables** add karo (Step 2 dekho)

3. **Deploy** button click karo
   - Ya GitHub push ke baad automatically deploy hoga

4. ✅ Deployment complete hone ke baad **Deployment URL** milega
   - Example: `https://your-project.vercel.app`

---

## 🐛 Troubleshooting

### Error: "supabaseKey is required"

**Solution:**
- `.env` file mein `VITE_SUPABASE_ANON_KEY` set karo
- Vercel mein environment variables add karo
- Redeploy karo

### Error: "RLS policy violation"

**Solution:**
- Supabase Dashboard → SQL Editor
- Migration file run karo (Step 1 dekho)
- Verify karo ki RLS policies applied hain

### Error: "Realtime not working"

**Solution:**
- Supabase Dashboard → Database → Replication
- Verify karo ki Realtime enabled hai for orders, order_items, timeline tables

### Build Fails on Vercel

**Solution:**
- Check Vercel build logs
- Verify environment variables are set
- Check `package.json` dependencies

---

## ✅ Post-Deployment Checklist

1. ✅ App URL open karo
2. ✅ Login karo (test user se)
3. ✅ Orders load ho rahe hain check karo
4. ✅ Dashboard load ho raha hai check karo
5. ✅ Real-time updates kaam kar rahe hain check karo
6. ✅ Different user roles se test karo (admin, sales, design, etc.)

---

## 📝 Important Notes

1. **Migration Date:** Sirf orders created after `2025-01-20` Supabase mein handle honge
2. **Firebase:** Ab READ-ONLY hai, koi write operation nahi hoga
3. **Users:** Agar Firebase users import karna hai, `npm run migrate-users` run karo (local pe)
4. **RLS:** Orders automatically filter honge based on user role/department

---

## 🎯 Quick Commands

```bash
# Local development
npm install
npm run dev

# Build check
npm run build

# Git push
git add .
git commit -m "Your message"
git push origin main

# User migration (local pe, Firebase users import karne ke liye)
npm run migrate-users
```

---

## 🔗 Links

- **Supabase Dashboard:** https://app.supabase.com/project/hswgdeldouyclpeqbbgq
- **Vercel Dashboard:** https://vercel.com/dashboard
- **GitHub Repo:** (Your repo URL)

---

**Ready to Deploy! 🚀**

