# Database Setup Instructions - Chhapai Tool

## 🚀 Quick Setup

### Step 1: Supabase Dashboard me jao
1. [Supabase Dashboard](https://app.supabase.com) me login karo
2. Apne project ko select karo (hswgdeldouyclpeqbbgq)

### Step 2: SQL Editor me jao
1. Left sidebar me **SQL Editor** click karo
2. **New Query** button click karo

### Step 3: Complete Database Setup Script Run Karo
1. `COMPLETE_DATABASE_SETUP.sql` file ko open karo
2. Puri file ka content copy karo
3. Supabase SQL Editor me paste karo
4. **Run** button click karo

### Step 4: Verify Setup
Script run hone ke baad verify karo ki sab tables ban gaye hain:

```sql
-- Check tables
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

Expected tables:
- `user_roles`
- `profiles`
- `orders`
- `order_items`
- `order_files`
- `timeline`
- `notifications`
- `user_settings`
- `user_work_logs`
- `work_notes`

## ✅ Features After Setup

### 1. Team Management
- ✅ Team members add kar sakte ho (role + department ke saath)
- ✅ Team members edit kar sakte ho
- ✅ Team members delete kar sakte ho (profile aur roles delete ho jayenge)
- ✅ User delete karte waqt assigned orders automatically unassign ho jayenge

### 2. Orders Management
- ✅ Orders create kar sakte ho
- ✅ Orders department-wise assign kar sakte ho
- ✅ Orders delete kar sakte ho (CASCADE delete - related items/files/timeline automatically delete)
- ✅ Department-wise access properly kaam karega

### 3. Security (RLS Policies)
- ✅ Admin sab kuch dekh sakta hai
- ✅ Sales sab orders dekh sakta hai
- ✅ Design sirf design department ke orders dekh sakta hai
- ✅ Prepress sirf prepress department ke orders dekh sakta hai
- ✅ Production sirf production department ke orders dekh sakta hai

## 🔧 Important Notes

### User Deletion
Jab aap team member delete karte ho:
- ✅ Profile delete ho jayega
- ✅ Roles delete ho jayenge
- ✅ Assigned orders automatically unassign ho jayenge
- ⚠️ Auth user (login account) Supabase Dashboard se manually delete karna padega

**Auth User Delete Karne Ke Liye:**
1. Supabase Dashboard > Authentication > Users
2. User ko find karo
3. Delete button click karo

Ya phir backend Edge Function banao jo Supabase Admin API use kare.

### Database Schema
Sab tables me **CASCADE DELETE** setup hai:
- Order delete → Items, Files, Timeline automatically delete
- User delete → Profile, Roles, Work Logs automatically delete
- Item delete → Files, Timeline entries automatically delete

## 🐛 Troubleshooting

### Error: "Could not find the table 'public.orders'"
**Solution:** `COMPLETE_DATABASE_SETUP.sql` script run karo (Step 3)

### Error: "Permission denied"
**Solution:** Check karo ki aap admin user se login hain ya nahi

### Orders nahi dikh rahe
**Solution:** 
1. Check karo ki orders table me data hai ya nahi
2. Check karo ki user ka role properly set hai
3. RLS policies check karo

### Team member add nahi ho raha
**Solution:**
1. Check karo ki Supabase Auth properly configured hai
2. Check karo ki email already exist nahi karta
3. Browser console me errors check karo

## 📝 Next Steps

1. ✅ Database setup complete
2. ✅ Team member add karo (role + department ke saath)
3. ✅ Order create karo
4. ✅ Department assign karo
5. ✅ Test karo ki sab properly kaam kar raha hai

## 🔗 Useful Links

- [Supabase Dashboard](https://app.supabase.com)
- [Supabase SQL Editor](https://app.supabase.com/project/hswgdeldouyclpeqbbgq/sql)
- [Supabase Auth Users](https://app.supabase.com/project/hswgdeldouyclpeqbbgq/auth/users)

## 💡 Tips

- Agar koi table missing hai, toh `COMPLETE_DATABASE_SETUP.sql` dobara run karo
- RLS policies automatically apply ho jayengi
- Indexes performance ke liye automatically create ho jayenge
- Storage bucket automatically setup ho jayega

---

**Setup Complete!** Ab aap tool use kar sakte ho. 🎉

