# Firebase Migration Guide

This project has been migrated from Supabase to Firebase. Follow these steps to set up and deploy:

## 1. Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project"
3. Enter project name and follow the setup wizard
4. Enable Google Analytics (optional)

## 2. Enable Firebase Services

### Authentication
1. Go to Authentication > Sign-in method
2. Enable "Email/Password" provider

### Firestore Database
1. Go to Firestore Database
2. Click "Create database"
3. Start in **production mode** (we'll set up rules)
4. Choose a location for your database

### Storage
1. Go to Storage
2. Click "Get started"
3. Start in **production mode**
4. Use the default bucket location

## 3. Get Firebase Configuration

1. Go to Project Settings (gear icon)
2. Scroll to "Your apps"
3. Click the web icon (`</>`)
4. Register your app
5. Copy the Firebase configuration object

## 4. Set Up Environment Variables

1. Create a `.env` file in the project root
2. Add your Firebase config:

```env
VITE_FIREBASE_API_KEY=your-api-key-here
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
```

## 5. Update Firebase Project ID

1. Open `.firebaserc`
2. Replace `"your-project-id"` with your actual Firebase project ID

## 6. Deploy Firestore Rules and Storage Rules

```bash
firebase deploy --only firestore:rules,storage:rules
```

## 7. Set Up Firestore Collections

The following collections will be created automatically when you use the app:
- `profiles` - User profiles
- `user_roles` - User roles and permissions
- `orders` - Order data
- `order_items` - Order items
- `order_files` - File metadata
- `timeline` - Order timeline entries
- `notifications` - User notifications
- `user_settings` - User preferences

## 8. Build and Deploy

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Deploy to Firebase Hosting
firebase deploy --only hosting
```

## 9. Access Your App

After deployment, you'll get a URL like:
`https://your-project-id.web.app`

## Important Notes

1. **Data Migration**: You'll need to manually migrate existing data from Supabase to Firestore if you have any.

2. **Security Rules**: The Firestore and Storage rules are configured in `firestore.rules` and `storage.rules`. Review and adjust them as needed.

3. **Indexes**: Firestore may require composite indexes for some queries. Create them as needed when you see errors in the console.

4. **File Storage**: Files are stored in Firebase Storage under:
   - `order-files/` - Order-related files
   - `avatars/` - User avatars

## Troubleshooting

- **Build errors**: Make sure all environment variables are set correctly
- **Authentication errors**: Verify Email/Password is enabled in Firebase Console
- **Permission errors**: Check Firestore rules match your use case
- **Storage errors**: Verify Storage rules allow authenticated users










