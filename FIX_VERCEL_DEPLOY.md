# 🔧 Vercel Auto-Deploy Fix Guide

## Problem:
1. Auto-deploy nahi ho raha
2. Vercel pe wrong GitHub account (nikhilxchhapai) dikha raha hai
3. Repo nikhil4sharma account mein hai

## ✅ Solution Steps:

### Step 1: Git Author Fix (Optional but Recommended)

Current author: `NikhilxChhapai`
Repo account: `Nikhil4sharma`

Agar author change karna hai:
```bash
git config user.name "Nikhil4sharma"
git config user.email "your-email@example.com"  # nikhil4sharma account ka email
```

Ya globally set karo:
```bash
git config --global user.name "Nikhil4sharma"
git config --global user.email "your-email@example.com"
```

### Step 2: Vercel GitHub Connection Fix

#### Option A: Disconnect and Reconnect (Recommended)

1. **Vercel Dashboard** → https://vercel.com/dashboard
2. **Settings** → **Git** (left sidebar)
3. **Disconnect** current GitHub connection
4. **Connect GitHub** again
5. **Select correct account**: `Nikhil4sharma` (not nikhilxchhapai)
6. **Authorize** Vercel to access repositories
7. **Select repository**: `Nikhil4sharma/chhapai`
8. **Import** project

#### Option B: Switch GitHub Account in Vercel

1. **Vercel Dashboard** → **Settings** → **Git**
2. **GitHub** section mein **Switch account** click karo
3. **Nikhil4sharma** account select karo
4. **Reconnect** repository

### Step 3: Verify Repository Connection

1. **Vercel Dashboard** → Your Project → **Settings** → **Git**
2. Check:
   - ✅ **Repository**: `Nikhil4sharma/chhapai`
   - ✅ **Production Branch**: `main`
   - ✅ **Auto-deploy**: Enabled

### Step 4: Trigger Manual Deploy (Immediate Fix)

Agar auto-deploy nahi ho raha, manually trigger karo:

1. **Vercel Dashboard** → Your Project
2. **Deployments** tab
3. **Redeploy** button (latest commit se)
4. Ya **Create Deployment** → **Use existing Build Cache** → **Deploy**

### Step 5: Check Webhook (If Still Not Working)

1. **GitHub Repository** → **Settings** → **Webhooks**
2. Check if Vercel webhook exists:
   - URL: `https://api.vercel.com/v1/integrations/deploy/...`
   - Events: `push`, `pull_request`
3. Agar nahi hai, Vercel automatically create karega after reconnecting

### Step 6: Environment Variables (Important!)

Vercel mein environment variables set karo:

1. **Vercel Dashboard** → Project → **Settings** → **Environment Variables**
2. **Add** karo:
   ```
   VITE_SUPABASE_URL = https://hswgdeldouyclpeqbbgq.supabase.co
   VITE_SUPABASE_ANON_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhzd2dkZWxkb3V5Y2xwZXFiYmdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYxMzU2NjAsImV4cCI6MjA4MTcxMTY2MH0.1Np96vCvDdFy_s2LSneyoorOLUvlpUw2AcAAemX3BnI
   ```
3. **Environment**: Production, Preview, Development (sab mein add karo)
4. **Save**

### Step 7: Test Auto-Deploy

1. Small change karo (comment add karo)
2. Commit aur push karo:
   ```bash
   git commit --allow-empty -m "test: trigger Vercel deploy"
   git push origin main
   ```
3. Vercel Dashboard mein check karo - deployment start hona chahiye

## 🔍 Troubleshooting

### If Auto-Deploy Still Not Working:

1. **Check Vercel Logs**:
   - Project → **Deployments** → Latest deployment → **View Function Logs**

2. **Check Build Settings**:
   - **Settings** → **General** → **Build & Development Settings**
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`

3. **Check GitHub Permissions**:
   - Vercel ko repository access chahiye
   - GitHub → Settings → Applications → Authorized OAuth Apps
   - Vercel ko full repo access hona chahiye

4. **Manual Trigger**:
   - Vercel CLI install karo: `npm i -g vercel`
   - Login: `vercel login`
   - Deploy: `vercel --prod`

## ✅ Expected Result

After fixing:
- ✅ Vercel pe correct account (Nikhil4sharma) dikhega
- ✅ Auto-deploy har push pe automatically hoga
- ✅ Deployment status: https://chhapai.vercel.app

---

**Quick Fix**: Vercel Dashboard → Settings → Git → Disconnect → Reconnect with correct account!


