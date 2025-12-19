@echo off
echo 🚀 Starting Firebase Deployment...

REM Check if Firebase CLI is installed
where firebase >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Firebase CLI not found. Installing...
    npm install -g firebase-tools
)

REM Check if logged in
echo 🔐 Checking Firebase authentication...
firebase projects:list >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ⚠️  Please login to Firebase first:
    echo    Run: firebase login
    echo    This will open a browser for authentication.
    exit /b 1
)

REM Set the project
echo 📦 Setting Firebase project...
firebase use chhapai-order-flow

REM Build the project
echo 🔨 Building project...
call npm run build

if %ERRORLEVEL% NEQ 0 (
    echo ❌ Build failed!
    exit /b 1
)

REM Deploy Firestore and Storage rules
echo 📋 Deploying Firestore and Storage rules...
firebase deploy --only firestore:rules,storage:rules

REM Deploy hosting
echo 🌐 Deploying to Firebase Hosting...
firebase deploy --only hosting

if %ERRORLEVEL% EQU 0 (
    echo ✅ Deployment successful!
    echo 🌍 Your app is live at: https://chhapai-order-flow.web.app
) else (
    echo ❌ Deployment failed!
    exit /b 1
)










