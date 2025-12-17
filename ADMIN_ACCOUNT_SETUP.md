# Admin Account Setup - हिंदी में

## समस्या
Login नहीं हो रहा क्योंकि user account अभी exist नहीं करता।

## Solution: Firebase Console से Admin Account बनाएं

### Step 1: Firebase Console खोलें
1. इस link पर जाएं: https://console.firebase.google.com/project/chhapai-order-flow/authentication/users
2. अगर login नहीं है तो Google account से login करें

### Step 2: Authentication Enable करें
1. Left sidebar में "Authentication" click करें
2. अगर "Get started" button दिखे तो उसे click करें
3. "Sign-in method" tab पर जाएं
4. "Email/Password" provider को enable करें:
   - "Email/Password" पर click करें
   - "Enable" toggle ON करें
   - "Save" click करें

### Step 3: User बनाएं
1. "Users" tab पर जाएं
2. "Add user" button click करें
3. Fill करें:
   - **Email**: `hi@chhapai.in`
   - **Password**: `11223344`
4. "Add user" click करें

### Step 4: Firestore में Profile और Role बनाएं

#### Profile बनाएं:
1. [Firestore Database](https://console.firebase.google.com/project/chhapai-order-flow/firestore) में जाएं
2. "Start collection" click करें
3. Collection ID: `profiles`
4. Document ID: User का UID (Authentication → Users में देखें)
5. Fields add करें:
   ```
   user_id (string): [user-uid]
   full_name (string): Admin User
   department (string): admin
   phone (null): (empty)
   avatar_url (null): (empty)
   created_at (timestamp): (current time)
   updated_at (timestamp): (current time)
   ```
6. "Save" click करें

#### Admin Role बनाएं:
1. "Start collection" click करें
2. Collection ID: `user_roles`
3. Document ID: `[user-uid]_admin` (जैसे: `abc123_admin`)
4. Fields add करें:
   ```
   user_id (string): [user-uid]
   role (string): admin
   created_at (timestamp): (current time)
   ```
5. "Save" click करें

### Step 5: Login करें
1. App में जाएं: `http://localhost:8080/auth` (dev mode में)
2. Email: `hi@chhapai.in`
3. Password: `11223344`
4. Login करें

## Alternative: App में Sign Up करें (अगर Sign Up option हो)

अगर Auth page में Sign Up option है:
1. App run करें: `npm run dev`
2. `/auth` page पर जाएं
3. "Sign Up" tab select करें
4. Fill करें:
   - Email: `hi@chhapai.in`
   - Password: `11223344`
   - Full Name: `Admin User`
   - Role: `admin`
5. Sign Up करें

## Important Notes

- **Firestore Database** पहले से create होना चाहिए
- **Authentication** enable होना चाहिए
- User का **UID** Authentication → Users में मिलेगा

## Troubleshooting

### अगर "400 Bad Request" error आए:
- Authentication enable नहीं है → Step 2 follow करें
- API key गलत है → `.env` file check करें

### अगर Firestore database नहीं है:
1. [Firestore Database](https://console.firebase.google.com/project/chhapai-order-flow/firestore) में जाएं
2. "Create database" click करें
3. "Start in production mode" select करें
4. Location choose करें
5. "Enable" click करें

### अगर user बन गया लेकिन login नहीं हो रहा:
- Firestore में `profiles` और `user_roles` collections check करें
- User UID सही है या नहीं verify करें



