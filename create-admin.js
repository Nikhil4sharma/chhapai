// Script to create admin user in Firebase
// Run with: node create-admin.js

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

async function createAdminUser() {
  try {
    const email = 'hi@chhapai.in';
    const password = '11223344';
    const fullName = 'Admin User';

    console.log('Creating admin user...');
    
    // Create user in Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    console.log('User created in Auth:', user.uid);

    // Create profile
    await setDoc(doc(db, 'profiles', user.uid), {
      user_id: user.uid,
      full_name: fullName,
      department: 'admin',
      phone: null,
      avatar_url: null,
      created_at: Timestamp.now(),
      updated_at: Timestamp.now(),
    });

    console.log('Profile created');

    // Create admin role
    await setDoc(doc(db, 'user_roles', `${user.uid}_admin`), {
      user_id: user.uid,
      role: 'admin',
      created_at: Timestamp.now(),
    });

    console.log('Admin role assigned');
    console.log('✅ Admin user created successfully!');
    console.log(`Email: ${email}`);
    console.log(`User ID: ${user.uid}`);
    
  } catch (error) {
    console.error('Error creating admin user:', error.message);
    
    if (error.code === 'auth/email-already-in-use') {
      console.log('⚠️  User already exists. Updating to admin role...');
      
      // Try to sign in and update role
      const { signInWithEmailAndPassword } = await import('firebase/auth');
      try {
        const userCredential = await signInWithEmailAndPassword(auth, 'hi@chhapai.in', '11223344');
        const user = userCredential.user;
        
        // Update profile
        await setDoc(doc(db, 'profiles', user.uid), {
          user_id: user.uid,
          full_name: 'Admin User',
          department: 'admin',
          phone: null,
          avatar_url: null,
          updated_at: Timestamp.now(),
        }, { merge: true });

        // Set admin role
        await setDoc(doc(db, 'user_roles', `${user.uid}_admin`), {
          user_id: user.uid,
          role: 'admin',
          created_at: Timestamp.now(),
        }, { merge: true });

        console.log('✅ User updated to admin successfully!');
      } catch (signInError) {
        console.error('Error signing in:', signInError.message);
      }
    }
  }
}

createAdminUser();



