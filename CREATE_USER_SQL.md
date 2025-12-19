# 📝 SQL Query: User Setup

## User UID
```
967ac67f-df74-4f96-93c9-052745267572
```

---

## ✅ SQL Query - Copy & Run

### Supabase SQL Editor Mein:

1. **SQL Editor:** https://app.supabase.com/project/hswgdeldouyclpeqbbgq/sql/new
2. **Copy-paste** neeche wali query:
3. **Run** click

---

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

-- Verify (optional - check if data inserted correctly)
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

## ✅ After Running

1. ✅ Profile created (profiles table)
2. ✅ Role assigned (user_roles table - admin role)
3. ✅ User ready for login!

---

## 🚀 Test Login

1. https://chhapai.vercel.app
2. Email: (Supabase Auth user ka email)
3. Password: (set kiye password)
4. Login should work!

---

**SQL query run karo - sab setup ho jayega! 🎯**

