// Script to create user profile in Firestore
// Run with: node create-user-profile.js

import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, setDoc, Timestamp } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDl6qUY1BZXWdHlQ42pgXloFilnqbhGqOk",
  authDomain: "chhapai-order-flow.firebaseapp.com",
  projectId: "chhapai-order-flow",
  storageBucket: "chhapai-order-flow.firebasestorage.app",
  messagingSenderId: "820561152102",
  appId: "1:820561152102:web:0ac516cf658696712f45a7",
  measurementId: "G-4EMX9HKBN4"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

async function createUserProfile() {
  try {
    const email = 'hi@chhapai.in';
    const password = '11223344';
    const fullName = 'Admin User';
    const role = 'admin';

    console.log('Creating user in Firebase Authentication...');
    
    // Create user in Firebase Auth
    let userCredential;
    try {
      userCredential = await createUserWithEmailAndPassword(auth, email, password);
      console.log('✅ User created in Authentication:', userCredential.user.uid);
    } catch (authError) {
      if (authError.code === 'auth/email-already-in-use') {
        console.log('⚠️  User already exists in Authentication. Signing in...');
        const { signInWithEmailAndPassword } = await import('firebase/auth');
        userCredential = await signInWithEmailAndPassword(auth, email, password);
        console.log('✅ Signed in with existing user:', userCredential.user.uid);
      } else {
        throw authError;
      }
    }

    const user = userCredential.user;
    const userId = user.uid;

    console.log('\nCreating profile in Firestore...');
    
    // Create profile
    const profileRef = doc(db, 'profiles', userId);
    await setDoc(profileRef, {
      user_id: userId,
      full_name: fullName,
      department: role,
      phone: null,
      avatar_url: null,
      created_at: Timestamp.now(),
      updated_at: Timestamp.now(),
    }, { merge: true });

    console.log('✅ Profile created in Firestore');

    // Create admin role
    console.log('\nCreating admin role in Firestore...');
    const roleRef = doc(db, 'user_roles', `${userId}_${role}`);
    await setDoc(roleRef, {
      user_id: userId,
      role: role,
      created_at: Timestamp.now(),
    }, { merge: true });

    console.log('✅ Admin role created in Firestore');
    
    console.log('\n🎉 User profile created successfully!');
    console.log('\nDetails:');
    console.log('Email:', email);
    console.log('User ID:', userId);
    console.log('Full Name:', fullName);
    console.log('Role:', role);
    console.log('\nYou can now login with:');
    console.log('Email: hi@chhapai.in');
    console.log('Password: 11223344');
    
  } catch (error) {
    console.error('❌ Error creating user profile:', error.message);
    console.error('Error code:', error.code);
    if (error.code === 'auth/email-already-in-use') {
      console.log('\n💡 User already exists. Profile should be created.');
    }
    process.exit(1);
  }
}

createUserProfile();










