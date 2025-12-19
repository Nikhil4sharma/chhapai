# 🔍 API Key Troubleshooting

## Error: 401 Invalid API Key

### Quick Checks

1. **Vercel Environment Variables:**
   - ✅ `VITE_SUPABASE_URL` = `https://hswgdeldouyclpeqbbgq.supabase.co`
   - ✅ `VITE_SUPABASE_ANON_KEY` = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhzd2dkZWxkb3V5Y2xwZXFiYmdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYxMzU2NjAsImV4cCI6MjA4MTcxMTY2MH0.1Np96vCvDdFy_s2LSneyoorOLUvlpUw2AcAAemX3BnI`

2. **Key Format:**
   - No spaces
   - Complete string (3 parts, dots se separated)
   - Starts with `eyJ...`

3. **Redeploy:**
   - Environment variable add ke baad **MUST** redeploy
   - Old deployment purane variables use karega

---

## Fix Steps

### 1. Verify Key in Vercel

1. Vercel Dashboard → Settings → Environment Variables
2. `VITE_SUPABASE_ANON_KEY` open karo
3. Value check:
   - Complete key hai?
   - No extra spaces?
   - Correct format?

### 2. Re-add Key

1. Delete `VITE_SUPABASE_ANON_KEY`
2. Add fresh:
   ```
   Name: VITE_SUPABASE_ANON_KEY
   Value: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhzd2dkZWxkb3V5Y2xwZXFiYmdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYxMzU2NjAsImV4cCI6MjA4MTcxMTY2MH0.1Np96vCvDdFy_s2LSneyoorOLUvlpUw2AcAAemX3BnI
   ```
3. **All environments** select
4. **Save**

### 3. Redeploy

1. Deployments → Latest → **"..."** → **Redeploy**
2. **Use existing Build Cache** = ❌ Uncheck
3. **Redeploy**
4. Wait 2-3 min

---

## Verify After Fix

1. https://chhapai.vercel.app
2. Hard refresh: Ctrl+Shift+R
3. Console (F12) - 401 error nahi aana chahiye
4. App load hona chahiye

---

**Key correctly add karo aur redeploy karo! ✅**

