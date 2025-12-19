# 👤 Supabase Mein User Create Karo

## Current Situation

Supabase Auth mein koi users nahi hain - pehle user create karna hoga!

---

## ✅ Step-by-Step: User Create

### Step 1: Add User Button

1. **Supabase Dashboard:** https://app.supabase.com/project/hswgdeldouyclpeqbbgq
2. **Authentication** → **Users** (left sidebar)
3. **"Add user"** button click (top right, green button)

### Step 2: Create User Form

**Option A: Create user manually**
1. **"Create new user"** select karo
2. Fill form:
   - **Email:** `hi@chhapai.in` (ya apna email)
   - **Password:** Set password (e.g., `11223344`)
   - **Auto Confirm User:** ✅ **CHECK** (important - immediate login)
3. **"Create user"** click

**Option B: Invite user**
- Invite email bhej sakte ho (but manual create faster hai)

---

## ✅ Step 3: User Profile & Role Create

User create hone ke baad, profile aur role add karna hoga:

### A. Profile Create (profiles table)

1. **Table Editor** → **profiles**
2. **Insert** → **Insert row**
3. Add:
   ```
   user_id: (Supabase Auth user ka UID - Users page se copy karo)
   full_name: Admin User (ya apna naam)
   department: sales (ya admin)
   ```
4. **Save**

### B. Role Create (user_roles table)

1. **Table Editor** → **user_roles**
2. **Insert** → **Insert row**
3. Add:
   ```
   user_id: (same UID as above)
   role: admin (ya sales, design, etc.)
   ```
4. **Save**

---

## 🔍 Quick: User UID Kaha Se Milega

1. **Authentication** → **Users**
2. Create kiye user pe click
3. **UID** copy karo (top mein dikhega)

---

## ✅ Complete Setup

After user create:

1. ✅ Supabase Auth user created
2. ✅ Profile created (profiles table)
3. ✅ Role assigned (user_roles table)
4. ✅ App mein login try karo

---

## 🚀 Test Login

1. https://chhapai.vercel.app open karo
2. Login page:
   - Email: `hi@chhapai.in` (ya create kiye user ka email)
   - Password: (set kiye password)
3. Login should work!

---

**Pehle user create karo Supabase Auth mein, phir profile aur role add karo! 🎯**

