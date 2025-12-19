# 🔧 Quick .env Setup

## Step 1: .env File Create Karein

Project root (`d:\Project\chhapai`) mein `.env` file banayo.

### Option A: PowerShell (Easiest)
```powershell
cd d:\Project\chhapai
New-Item -Path .env -ItemType File -Force
```

### Option B: Manually
1. Project folder kholo
2. New file banayo named `.env` (dot se start)

---

## Step 2: Content Add Karein

`.env` file mein yeh exactly copy-paste karo:

```env
VITE_SUPABASE_URL=https://hswgdeldouyclpeqbbgq.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY_HERE
```

---

## Step 3: Supabase API Key Copy Karein

1. **Browser mein kholo:**
   https://app.supabase.com/project/hswgdeldouyclpeqbbgq/settings/api

2. **anon public** key copy karo (yeh long string hai, starts with `eyJ...`)

3. `.env` file mein `YOUR_ANON_KEY_HERE` ki jagah paste karo

**Example:**
```env
VITE_SUPABASE_URL=https://hswgdeldouyclpeqbbgq.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhzd2dkZWxkb3V5Y2xwZXFiYmdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ3MjE2MDAsImV4cCI6MjA1MDI5NzYwMH0.example_key_here
```

---

## Step 4: Dev Server Restart

```bash
# Stop current server (Ctrl+C agar running hai)
# Then start again
npm run dev
```

---

## ✅ Done!

Ab app run hogi without errors!

---

## 🐛 Check List

- [ ] `.env` file project root mein hai? (`d:\Project\chhapai\.env`)
- [ ] File content correct hai? (no typos)
- [ ] `VITE_` prefix hai dono variables mein?
- [ ] Dev server restart kiya?
- [ ] API key correctly copied hai? (full key, no spaces)

---

**Test: `npm run dev` 🚀**

