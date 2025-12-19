# Database Cleanup Instructions

## Overview
Yeh script database se saare orders, order_items, order_files, aur timeline entries delete karega. Users, profiles, aur user_roles preserve rahenge.

## Kya Delete Hoga:
- ✅ `orders` collection (saare orders)
- ✅ `order_items` collection (saare order items)
- ✅ `order_files` collection (saare order files)
- ✅ `timeline` collection (saare timeline logs)
- ✅ Firebase Storage files (saare uploaded files)

## Kya Preserve Hoga:
- ✅ Users (Firebase Authentication)
- ✅ Profiles (user profiles)
- ✅ User Roles (user_roles collection)

## Usage

### Method 1: NPM Script (Recommended)
```bash
npm run cleanup-db
```

### Method 2: Direct Node Command
```bash
node cleanup-database.js
```

## Steps:

1. **Script run karein:**
   ```bash
   npm run cleanup-db
   ```

2. **Confirmation:**
   - Script aapko confirmation mangayega
   - Type karein: `DELETE` (exactly)
   - Enter press karein

3. **Wait karein:**
   - Script automatically saare data delete kar dega
   - Progress console mein dikhega
   - Time lag sakta hai agar data zyada hai

4. **Complete:**
   - Script completion message dikhayega
   - Summary dikhayega kitne documents delete hue

5. **Fresh Start:**
   - Ab aap fresh orders WooCommerce se sync kar sakte hain
   - Database clean hai aur ready hai

## Important Notes:

⚠️ **WARNING:**
- Yeh action **irreversible** hai
- Pehle backup lein agar zarurat ho
- Sirf tab run karein jab aap sure ho

✅ **After Cleanup:**
- Database clean hai
- Users aur profiles safe hain
- Fresh orders sync kar sakte hain

## Troubleshooting:

### Error: Permission Denied
- Firebase project mein admin access check karein
- Firestore rules check karein

### Error: Collection Not Found
- Normal hai agar collection empty hai
- Script continue karega

### Storage Files Not Deleted
- Storage permissions check karein
- Manual deletion kar sakte hain Firebase Console se

## Example Output:

```
🧹 Database Cleanup Script
==================================================

⚠️  WARNING: This will DELETE ALL order-related data!
   - All orders
   - All order_items
   - All order_files
   - All timeline entries
   - All storage files

✅ The following will be KEPT:
   - Users (Firebase Auth)
   - Profiles
   - User roles

⚠️  This action CANNOT be undone!

Type "DELETE" to confirm: DELETE

🧹 Starting database cleanup...

🗑️  Deleting collection: order_files...
   Deleted 150 documents from order_files...
✅ Deleted 150 documents from order_files

🗑️  Deleting collection: order_items...
   Deleted 500 documents from order_items...
✅ Deleted 500 documents from order_items

...

✅ Database cleanup completed successfully!
==================================================

📊 Summary:
   Orders deleted: 100
   Order Items deleted: 500
   Order Files deleted: 150
   Timeline entries deleted: 300
   Storage files deleted: 200

⏱️  Time taken: 45.23 seconds

✅ Database is now clean and ready for fresh order sync!
👥 Users, profiles, and user_roles are preserved.

💡 You can now sync fresh orders from WooCommerce.
```

