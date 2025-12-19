# Admin Account Setup Guide

## Option 1: Firebase Console से Manual Setup (Recommended)

### Step 1: Firebase Console में जाएं
1. [Firebase Console](https://console.firebase.google.com/project/chhapai-order-flow/authentication/users) खोलें
2. Authentication section में जाएं
3. "Users" tab पर click करें

### Step 2: User बनाएं
1. "Add user" button click करें
2. Email: `hi@chhapai.in`
3. Password: `11223344`
4. "Add user" click करें

### Step 3: Firestore में Admin Role Set करें
1. [Firestore Database](https://console.firebase.google.com/project/chhapai-order-flow/firestore) में जाएं
2. नया collection बनाएं: `profiles`
3. Document ID = user का UID (Authentication users में देखें)
4. Fields add करें:
   ```
   user_id: [user-uid]
   full_name: "Admin User"
   department: "admin"
   phone: null
   avatar_url: null
   created_at: [current timestamp]
   updated_at: [current timestamp]
   ```

5. नया collection बनाएं: `user_roles`
6. Document ID = `[user-uid]_admin`
7. Fields add करें:
   ```
   user_id: [user-uid]
   role: "admin"
   created_at: [current timestamp]
   ```

## Option 2: Code से Setup (Advanced)

अगर आप Node.js environment में हैं, तो `create-admin.js` script run करें:

```bash
node create-admin.js
```

**Note:** यह script Firebase Admin SDK की जरूरत होगी, या browser में run करना होगा।

## Option 3: App में Sign Up करें

1. App को run करें: `npm run dev`
2. `/auth` page पर जाएं
3. "Sign Up" करें:
   - Email: `hi@chhapai.in`
   - Password: `11223344`
   - Full Name: `Admin User`
   - Role: `admin` select करें

4. Sign up के बाद, Firestore में manually role update करें (Option 1 के Step 3 की तरह)

## Verification

Login करने के बाद check करें:
1. Firebase Console → Authentication → Users में user दिखना चाहिए
2. Firestore → `profiles` collection में profile होना चाहिए
3. Firestore → `user_roles` collection में admin role होना चाहिए

## Troubleshooting

### अगर "Email already in use" error आए:
- User पहले से exist करता है
- Option 1 के Step 3 follow करें (role manually set करें)

### अगर Authentication enable नहीं है:
1. Firebase Console → Authentication
2. "Get started" click करें
3. "Email/Password" enable करें
4. "Save" click करें

### अगर Firestore database नहीं है:
1. Firebase Console → Firestore Database
2. "Create database" click करें
3. "Start in production mode" select करें
4. Location choose करें और "Enable" click करें









