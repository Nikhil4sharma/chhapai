# 🔧 .env File Setup - Step by Step

## ✅ .env File Already Exists!

File already hai, ab bas API key add karni hai.

---

## Step 1: Supabase API Key Copy Karein

1. **Browser mein kholo:**
   https://app.supabase.com/project/hswgdeldouyclpeqbbgq/settings/api

2. **anon public** key copy karo
   - Yeh long string hai
   - Starts with `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
   - Full key copy karo (sab)

---

## Step 2: .env File Edit Karein

Project root mein `.env` file kholo (`d:\Project\chhapai\.env`)

File mein yeh add karo (agar nahi hai):

```env
VITE_SUPABASE_URL=https://hswgdeldouyclpeqbbgq.supabase.co
VITE_SUPABASE_ANON_KEY=PASTE_YOUR_ANON_KEY_HERE
```

**Important:**
- `PASTE_YOUR_ANON_KEY_HERE` ki jagah actual key paste karo
- No spaces before/after `=`
- No quotes needed

**Example (after adding key):**
```env
VITE_SUPABASE_URL=https://hswgdeldouyclpeqbbgq.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhzd2dkZWxkb3V5Y2xwZXFiYmdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ3MjE2MDAsImV4cCI6MjA1MDI5NzYwMH0.actual_key_here
```

---

## Step 3: Save & Restart

1. `.env` file **Save** karo
2. **Dev server restart** karo:
   ```bash
   # Stop (Ctrl+C)
   npm run dev
   ```

---

## ✅ Done!

Ab app run hogi without errors!

---

## 🐛 Still Error Aaye?

1. ✅ `.env` file save ki?
2. ✅ Key correctly copied? (full key, no spaces)
3. ✅ `VITE_` prefix hai?
4. ✅ Dev server restart kiya?
5. ✅ File location correct? (`d:\Project\chhapai\.env`)

---

**Test: `npm run dev` 🚀**

