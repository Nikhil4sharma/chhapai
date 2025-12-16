# Firebase Deployment Instructions

Your Firebase configuration has been set up! Follow these steps to deploy:

## Step 1: Login to Firebase

```bash
firebase login
```

This will open a browser window for you to authenticate with your Google account.

## Step 2: Initialize Firebase Hosting (if not already done)

```bash
firebase init hosting
```

When prompted:
- **What do you want to use as your public directory?** → `dist`
- **Configure as a single-page app?** → `Yes`
- **Set up automatic builds and deploys with GitHub?** → `No` (or Yes if you want)

## Step 3: Deploy Firestore Rules and Storage Rules

```bash
firebase deploy --only firestore:rules,storage:rules
```

## Step 4: Deploy to Firebase Hosting

```bash
npm run build
firebase deploy --only hosting
```

## Step 5: Access Your App

After successful deployment, your app will be available at:
- **Hosting URL**: `https://chhapai-order-flow.web.app`
- **Custom Domain** (if configured): Your custom domain

## Quick Deploy (All Steps Combined)

If you've already initialized hosting, you can run:

```bash
# Build the project
npm run build

# Deploy everything
firebase deploy
```

## Troubleshooting

### If you get authentication errors:
1. Run `firebase login` again
2. Make sure you're logged in with the account that owns the Firebase project

### If hosting is not initialized:
1. Run `firebase init hosting`
2. Select `dist` as your public directory
3. Choose "Yes" for single-page app

### If you need to set up Firestore:
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `chhapai-order-flow`
3. Go to Firestore Database
4. Click "Create database"
5. Start in **production mode**
6. Choose a location

### If you need to set up Storage:
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `chhapai-order-flow`
3. Go to Storage
4. Click "Get started"
5. Start in **production mode**

## Your Firebase Project Details

- **Project ID**: `chhapai-order-flow`
- **Project URL**: `https://console.firebase.google.com/project/chhapai-order-flow`
- **Hosting URL**: `https://chhapai-order-flow.web.app` (after deployment)

## Next Steps After Deployment

1. **Enable Authentication**:
   - Go to Firebase Console → Authentication → Sign-in method
   - Enable "Email/Password"

2. **Set up Firestore** (if not done):
   - Create database in production mode
   - The security rules are already configured in `firestore.rules`

3. **Set up Storage** (if not done):
   - Create storage bucket
   - The security rules are already configured in `storage.rules`

4. **Test your app**:
   - Visit the hosting URL
   - Create a test user account
   - Verify all features work correctly

