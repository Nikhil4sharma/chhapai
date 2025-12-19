# ⚡ Quick Fix: 401 Invalid API Key

## Immediate Steps

### 1. Vercel Environment Variables

**URL:** https://vercel.com/dashboard → chhapai → Settings → Environment Variables

**Add/Update:**
```
VITE_SUPABASE_ANON_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhzd2dkZWxkb3V5Y2xwZXFiYmdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYxMzU2NjAsImV4cCI6MjA4MTcxMTY2MH0.1Np96vCvDdFy_s2LSneyoorOLUvlpUw2AcAAemX3BnI

VITE_SUPABASE_URL = https://hswgdeldouyclpeqbbgq.supabase.co
```

**Important:**
- No spaces
- All environments select
- Save

### 2. REDEPLOY

**Deployments** → Latest → **"..."** → **Redeploy**
- Build cache uncheck
- Wait 2-3 min

### 3. Test

- https://chhapai.vercel.app
- Ctrl+Shift+R (hard refresh)
- Console check - 401 error nahi aana chahiye

---

**Yeh 3 steps follow karo - error fix ho jayega! 🚀**

