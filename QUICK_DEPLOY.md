# Quick Deployment Guide

## Step 1: Login to Firebase (One-time, requires browser)

Open your terminal and run:
```bash
firebase login
```

This will open your browser. Log in with your Google account (chd@chhapai.in).

## Step 2: Verify Project Access

After logging in, verify you can access the project:
```bash
firebase projects:list
```

You should see `chhapai-order-flow` in the list.

## Step 3: Deploy Everything

Once logged in, simply run:

```bash
npm run build && firebase deploy
```

Or use the deployment script:
- **Windows**: `deploy.bat`
- **Linux/Mac**: `bash deploy.sh`

## Alternative: Manual Step-by-Step

If the script doesn't work, run these commands one by one:

```bash
# 1. Set the project
firebase use chhapai-order-flow

# 2. Build the app
npm run build

# 3. Deploy rules
firebase deploy --only firestore:rules,storage:rules

# 4. Deploy hosting
firebase deploy --only hosting
```

## Your App URL

After successful deployment, your app will be live at:
**https://chhapai-order-flow.web.app**

## Troubleshooting

### If project doesn't exist:
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project with ID: `chhapai-order-flow`
3. Then run the deployment commands

### If you get permission errors:
1. Make sure you're logged in with the correct Google account
2. Verify the account has access to the Firebase project
3. Check project permissions in Firebase Console

### If hosting is not initialized:
Run: `firebase init hosting`
- Select `dist` as public directory
- Choose "Yes" for single-page app

