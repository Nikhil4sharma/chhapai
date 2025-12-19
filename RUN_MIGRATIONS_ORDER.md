# 📋 Migration Run Order (IMPORTANT!)

## ⚠️ Error Solution

```
ERROR: relation "public.profiles" does not exist
```

**Matlab:** Tables create nahi hui - base migration run karni hogi pehle!

---

## ✅ Step 1: Base Migration (Tables Create)

### File: `RUN_BASE_MIGRATION.sql`

1. **SQL Editor:** https://app.supabase.com/project/hswgdeldouyclpeqbbgq/sql/new
2. **File open:** `RUN_BASE_MIGRATION.sql` (main project mein)
3. **Copy-paste** complete SQL
4. **Run** click
5. ✅ Tables created!

---

## ✅ Step 2: User Setup (After Tables Created)

Ab user setup SQL run karo:

```sql
-- Create Profile
INSERT INTO public.profiles (
  user_id,
  full_name,
  department,
  created_at,
  updated_at
) VALUES (
  '967ac67f-df74-4f96-93c9-052745267572',
  'Admin User',
  'sales',
  NOW(),
  NOW()
)
ON CONFLICT (user_id) DO NOTHING;

-- Create User Role (Admin)
INSERT INTO public.user_roles (
  user_id,
  role,
  created_at
) VALUES (
  '967ac67f-df74-4f96-93c9-052745267572',
  'admin',
  NOW()
)
ON CONFLICT (user_id) DO NOTHING;
```

---

## ✅ Step 3: Verify

```sql
SELECT 
  u.id as auth_user_id,
  u.email,
  p.full_name,
  p.department,
  ur.role
FROM auth.users u
LEFT JOIN public.profiles p ON p.user_id = u.id
LEFT JOIN public.user_roles ur ON ur.user_id = u.id
WHERE u.id = '967ac67f-df74-4f96-93c9-052745267572';
```

---

## 📝 Order Important!

1. ✅ **Pehle:** Base migration (tables create)
2. ✅ **Phir:** User setup (profile & role)
3. ✅ **Phir:** Test login

---

**Pehle base migration run karo! 🚀**

