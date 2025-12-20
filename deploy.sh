#!/bin/bash

echo "🚀 Starting Firebase Deployment..."

# Check if Firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo "❌ Firebase CLI not found. Installing..."
    npm install -g firebase-tools
fi

# Check if logged in
echo "🔐 Checking Firebase authentication..."
if ! firebase projects:list &> /dev/null; then
    echo "⚠️  Please login to Firebase first:"
    echo "   Run: firebase login"
    echo "   This will open a browser for authentication."
    exit 1
fi

# Set the project
echo "📦 Setting Firebase project..."
firebase use chhapai-order-flow

# Build the project
echo "🔨 Building project..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed!"
    exit 1
fi

# Deploy Firestore and Storage rules
echo "📋 Deploying Firestore and Storage rules..."
firebase deploy --only firestore:rules,storage:rules

# Deploy hosting
echo "🌐 Deploying to Firebase Hosting..."
firebase deploy --only hosting

if [ $? -eq 0 ]; then
    echo "✅ Deployment successful!"
    echo "🌍 Your app is live at: https://chhapai-order-flow.web.app"
else
    echo "❌ Deployment failed!"
    exit 1
fi











