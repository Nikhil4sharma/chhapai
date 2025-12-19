# 🔧 Local Environment Setup

## Step 1: Create `.env` File

Project root mein `.env` file banayo (agar nahi hai):

### Windows:
```bash
# PowerShell mein
New-Item -Path .env -ItemType File

# Ya manually create karo
```

### Mac/Linux:
```bash
touch .env
```

---

## Step 2: Add Environment Variables

`.env` file mein yeh add karo:

```env
VITE_SUPABASE_URL=https://hswgdeldouyclpeqbbgq.supabase.co
VITE_SUPABASE_ANON_KEY=your-actual-anon-key-here
```

---

## Step 3: Get Supabase API Key

1. **Supabase Dashboard** kholo:
   https://app.supabase.com/project/hswgdeldouyclpeqbbgq

2. **Settings** → **API** section mein jao

3. **anon public** key copy karo (yeh long string hai)

4. `.env` file mein paste karo:

```env
VITE_SUPABASE_URL=https://hswgdeldouyclpeqbbgq.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... (your actual key)
```

---

## Step 4: Restart Dev Server

Environment variables load karne ke liye dev server restart karo:

```bash
# Stop current server (Ctrl+C)
# Then start again
npm run dev
```

---

## ✅ Done!

Ab app local pe run hogi without errors!

---

## 🐛 Still Getting Error?

1. ✅ `.env` file project root mein hai?
2. ✅ Variables correctly typed hain? (no extra spaces)
3. ✅ Dev server restart kiya?
4. ✅ `.env` file mein `VITE_` prefix hai?

---

**Test karo: `npm run dev` 🚀**

