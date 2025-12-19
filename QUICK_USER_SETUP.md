# ⚡ Quick: Supabase User Setup

## Step 1: Auth User Create

1. **Authentication** → **Users** → **"Add user"**
2. Fill:
   - Email: `hi@chhapai.in`
   - Password: `11223344`
   - ✅ **Auto Confirm User** (CHECK!)
3. **Create user**

---

## Step 2: Get User UID

1. Created user pe click
2. **UID** copy karo

---

## Step 3: Profile Create

**Table Editor** → **profiles** → **Insert row**:
```
user_id: (paste UID)
full_name: Admin User
department: admin
```

---

## Step 4: Role Create

**Table Editor** → **user_roles** → **Insert row**:
```
user_id: (same UID)
role: admin
```

---

## ✅ Done!

App mein login:
- Email: `hi@chhapai.in`
- Password: `11223344`

---

**3 steps: User → Profile → Role! 🚀**

