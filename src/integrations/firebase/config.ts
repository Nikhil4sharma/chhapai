import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getAnalytics } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: "AIzaSyDl6qUY1BZXWdHlQ42pgXloFilnqbhGqOk",
  authDomain: "chhapai-order-flow.firebaseapp.com",
  projectId: "chhapai-order-flow",
  storageBucket: "chhapai-order-flow.firebasestorage.app",
  messagingSenderId: "820561152102",
  appId: "1:820561152102:web:0ac516cf658696712f45a7",
  measurementId: "G-4EMX9HKBN4"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Initialize Analytics (only in browser environment)
if (typeof window !== 'undefined') {
  getAnalytics(app);
}

export default app;

