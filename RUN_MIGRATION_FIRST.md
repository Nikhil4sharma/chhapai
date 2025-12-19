# ⚠️ IMPORTANT: Migration Run Karna Hoga Pehle!

## Problem

```
ERROR: relation "public.profiles" does not exist
```

**Matlab:** Tables create nahi hui hain - migration run nahi hui!

---

## ✅ Solution: Migration Run Karo

### Step 1: SQL Migration File

**File:** `supabase/migrations/20250120000000_clean_supabase_migration.sql`

### Step 2: Run in Supabase

1. **SQL Editor:** https://app.supabase.com/project/hswgdeldouyclpeqbbgq/sql/new
2. **Migration file** open karo (project mein: `supabase/migrations/20250120000000_clean_supabase_migration.sql`)
3. **Complete file** copy-paste karo
4. **Run** click
5. Wait - tables create hongi

### Step 3: Verify Tables Created

SQL Editor mein run karo:
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public';
```

Should show:
- profiles
- user_roles
- orders
- order_items
- etc.

---

## ✅ After Migration

1. Migration run complete
2. Tables created
3. **Phir** user setup SQL run karo (pehle wali query)

---

## ⚠️ Order Important Hai!

1. **Pehle:** Migration run karo (tables create karega)
2. **Phir:** User setup SQL run karo (profile & role create)

---

**Pehle migration run karo, phir user setup! 🚀**

