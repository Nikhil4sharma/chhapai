// Script to clean up all orders, order_items, order_files, and timeline from Firestore
// This will DELETE all order-related data but KEEP users, profiles, and user_roles
// Run with: node cleanup-database.js

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, deleteDoc, doc, query, limit, startAfter } from 'firebase/firestore';
import { getStorage, ref, listAll, deleteObject } from 'firebase/storage';
import { createInterface } from 'readline';

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
const db = getFirestore(app);
const storage = getStorage(app);

// Helper function to delete all documents from a collection (handles large collections)
async function deleteCollection(collectionName) {
  console.log(`\n🗑️  Deleting collection: ${collectionName}...`);
  let deletedCount = 0;
  let lastDoc = null;
  const batchSize = 500;

  try {
    while (true) {
      let q;
      if (lastDoc) {
        q = query(collection(db, collectionName), limit(batchSize), startAfter(lastDoc));
      } else {
        q = query(collection(db, collectionName), limit(batchSize));
      }

      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        break;
      }

      // Delete documents in parallel
      const deletePromises = snapshot.docs.map(async (docSnapshot) => {
        await deleteDoc(doc(db, collectionName, docSnapshot.id));
        deletedCount++;
      });

      await Promise.all(deletePromises);
      lastDoc = snapshot.docs[snapshot.docs.length - 1];

      console.log(`   Deleted ${deletedCount} documents from ${collectionName}...`);

      // If we got fewer documents than batch size, we're done
      if (snapshot.docs.length < batchSize) {
        break;
      }
    }

    console.log(`✅ Deleted ${deletedCount} documents from ${collectionName}`);
    return deletedCount;
  } catch (error) {
    console.error(`❌ Error deleting ${collectionName}:`, error.message);
    throw error;
  }
}

// Helper function to recursively delete all files from Firebase Storage
async function deleteStorageFiles() {
  console.log(`\n🗑️  Deleting files from Firebase Storage...`);
  let deletedCount = 0;

  // Recursive function to delete all files in a directory
  async function deleteDirectory(dirRef) {
    try {
      const result = await listAll(dirRef);
      
      // Delete all files in current directory
      const fileDeletePromises = result.items.map(async (itemRef) => {
        try {
          await deleteObject(itemRef);
          deletedCount++;
          if (deletedCount % 10 === 0) {
            console.log(`   Deleted ${deletedCount} files...`);
          }
        } catch (error) {
          console.error(`   Error deleting file ${itemRef.fullPath}:`, error.message);
        }
      });

      await Promise.all(fileDeletePromises);

      // Recursively delete files in subdirectories
      const dirDeletePromises = result.prefixes.map(prefixRef => deleteDirectory(prefixRef));
      await Promise.all(dirDeletePromises);
    } catch (error) {
      // Directory might not exist or be empty
      if (error.code !== 'storage/object-not-found') {
        console.error(`   Error accessing directory:`, error.message);
      }
    }
  }

  try {
    // Start from root
    const rootRef = ref(storage, '/');
    await deleteDirectory(rootRef);

    console.log(`✅ Deleted ${deletedCount} files from Storage`);
    return deletedCount;
  } catch (error) {
    console.error(`❌ Error deleting storage files:`, error.message);
    // Don't throw - storage might be empty or have permission issues
    console.log(`   Note: Some files may not have been deleted. This is okay if storage is empty.`);
    return deletedCount;
  }
}

// Function to ask for user confirmation
function askConfirmation() {
  return new Promise((resolve) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout
    });

    console.log('\n⚠️  WARNING: This will DELETE ALL order-related data!');
    console.log('   - All orders');
    console.log('   - All order_items');
    console.log('   - All order_files');
    console.log('   - All timeline entries');
    console.log('   - All storage files');
    console.log('\n✅ The following will be KEPT:');
    console.log('   - Users (Firebase Auth)');
    console.log('   - Profiles');
    console.log('   - User roles');
    console.log('\n⚠️  This action CANNOT be undone!\n');

    rl.question('Type "DELETE" to confirm: ', (answer) => {
      rl.close();
      resolve(answer.trim() === 'DELETE');
    });
  });
}

async function cleanupDatabase() {
  console.log('🧹 Database Cleanup Script');
  console.log('='.repeat(50));

  // Ask for confirmation
  const confirmed = await askConfirmation();
  
  if (!confirmed) {
    console.log('\n❌ Cleanup cancelled. No data was deleted.');
    process.exit(0);
  }

  console.log('\n🧹 Starting database cleanup...\n');

  const startTime = Date.now();
  const stats = {
    orders: 0,
    order_items: 0,
    order_files: 0,
    timeline: 0,
    storage_files: 0,
  };

  try {
    // Delete collections in order (respecting dependencies)
    // 1. Delete order_files first (references order_items and orders)
    stats.order_files = await deleteCollection('order_files');

    // 2. Delete order_items (references orders)
    stats.order_items = await deleteCollection('order_items');

    // 3. Delete timeline (references orders)
    stats.timeline = await deleteCollection('timeline');

    // 4. Delete orders (main collection)
    stats.orders = await deleteCollection('orders');

    // 5. Delete storage files
    stats.storage_files = await deleteStorageFiles();

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    console.log('\n' + '='.repeat(50));
    console.log('✅ Database cleanup completed successfully!');
    console.log('='.repeat(50));
    console.log('\n📊 Summary:');
    console.log(`   Orders deleted: ${stats.orders}`);
    console.log(`   Order Items deleted: ${stats.order_items}`);
    console.log(`   Order Files deleted: ${stats.order_files}`);
    console.log(`   Timeline entries deleted: ${stats.timeline}`);
    console.log(`   Storage files deleted: ${stats.storage_files}`);
    console.log(`\n⏱️  Time taken: ${duration} seconds`);
    console.log('\n✅ Database is now clean and ready for fresh order sync!');
    console.log('👥 Users, profiles, and user_roles are preserved.');
    console.log('\n💡 You can now sync fresh orders from WooCommerce.');

  } catch (error) {
    console.error('\n❌ Error during cleanup:', error.message);
    console.error('Error details:', error);
    process.exit(1);
  }
}

// Run cleanup
cleanupDatabase();

