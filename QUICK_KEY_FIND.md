# ⚡ Quick: Publishable Key Find Karein

## Current Page Pe

1. **URL:** `https://app.supabase.com/project/hswgdeldouyclpeqbbgq/settings/api`

2. **Page pe neeche scroll karo:**
   - "API Keys" section neeche hota hai
   - "publishable" key dikhegi (old "anon" key ka replacement)

3. **Copy karo:**
   - Long string (eyJ... se start)
   - Copy button click

---

## Vercel Pe Add

```
Name: VITE_SUPABASE_ANON_KEY
Value: (publishable key paste karo)
Environment: Production, Preview, Development (all)
```

---

## ⚠️ Important

- **"publishable"** key = **"anon"** key (same functionality)
- Code mein `VITE_SUPABASE_ANON_KEY` naam se use hogi
- Value = publishable key

---

**"publishable" key copy karo - yeh hi anon key hai! ✅**

