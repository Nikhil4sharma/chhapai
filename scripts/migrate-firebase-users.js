/**
 * Firebase User Import Script
 * 
 * This script migrates users from Firebase Auth to Supabase Auth
 * 
 * Usage:
 *   node scripts/migrate-firebase-users.js
 * 
 * Requirements:
 *   - Firebase Admin SDK credentials (service account JSON)
 *   - Supabase service role key
 *   - Node.js environment
 */

// Note: Firebase Admin SDK requires CommonJS
// Run with: node scripts/migrate-firebase-users.js
const { initializeApp, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');
const { createClient } = require('@supabase/supabase-js');
const { readFileSync } = require('fs');
const { join } = require('path');

// Configuration - Environment variables se lo
const FIREBASE_SERVICE_ACCOUNT_PATH = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || './firebase-service-account.json';
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://hswgdeldouyclpeqbbgq.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  console.error('   Please set it in .env file or pass it as environment variable');
  process.exit(1);
}

// Initialize Firebase Admin
let firebaseApp;
try {
  const serviceAccount = JSON.parse(readFileSync(FIREBASE_SERVICE_ACCOUNT_PATH, 'utf8'));
  firebaseApp = initializeApp({
    credential: cert(serviceAccount),
  });
  console.log('✅ Firebase Admin initialized');
} catch (error) {
  console.error('❌ Error initializing Firebase Admin:', error.message);
  console.error('   Make sure FIREBASE_SERVICE_ACCOUNT_PATH points to a valid service account JSON file');
  process.exit(1);
}

const firebaseAuth = getAuth(firebaseApp);
const firestore = getFirestore(firebaseApp);

// Initialize Supabase Admin Client (with service role key for admin operations)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Migration tracking
const migrationStats = {
  total: 0,
  successful: 0,
  skipped: 0,
  failed: 0,
  errors: [],
};

/**
 * Fetch users from Firebase Auth
 */
async function fetchFirebaseUsers() {
  console.log('\n📥 Fetching users from Firebase Auth...');
  const users = [];
  let nextPageToken;

  do {
    const listUsersResult = await firebaseAuth.listUsers(1000, nextPageToken);
    users.push(...listUsersResult.users);
    nextPageToken = listUsersResult.pageToken;
    console.log(`   Fetched ${users.length} users so far...`);
  } while (nextPageToken);

  console.log(`✅ Total Firebase users found: ${users.length}`);
  return users;
}

/**
 * Fetch user profiles from Firestore
 */
async function fetchFirebaseProfiles(userIds) {
  console.log('\n📥 Fetching profiles from Firestore...');
  const profiles = {};
  
  // Firestore 'in' query limit is 10, so batch the queries
  const batches = [];
  for (let i = 0; i < userIds.length; i += 10) {
    const batch = userIds.slice(i, i + 10);
    batches.push(
      firestore.collection('profiles').where('user_id', 'in', batch).get()
    );
  }

  const results = await Promise.all(batches);
  results.forEach(snapshot => {
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.user_id) {
        profiles[data.user_id] = data;
      }
    });
  });

  console.log(`✅ Total profiles found: ${Object.keys(profiles).length}`);
  return profiles;
}

/**
 * Fetch user roles from Firestore
 */
async function fetchFirebaseRoles(userIds) {
  console.log('\n📥 Fetching roles from Firestore...');
  const roles = {};

  // Query user_roles collection
  const batches = [];
  for (let i = 0; i < userIds.length; i += 10) {
    const batch = userIds.slice(i, i + 10);
    batches.push(
      firestore.collection('user_roles')
        .where('user_id', 'in', batch)
        .get()
    );
  }

  const results = await Promise.all(batches);
  results.forEach(snapshot => {
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.user_id && data.role) {
        if (!roles[data.user_id]) {
          roles[data.user_id] = [];
        }
        roles[data.user_id].push(data.role);
      }
    });
  });

  console.log(`✅ Total users with roles: ${Object.keys(roles).length}`);
  return roles;
}

/**
 * Create user in Supabase Auth
 */
async function createSupabaseUser(firebaseUser, profile, roles) {
  try {
    // Check if user already exists in Supabase by email
    const { data: existingUser } = await supabase.auth.admin.getUserByEmail(firebaseUser.email);
    
    if (existingUser?.user) {
      console.log(`   ⏭️  User ${firebaseUser.email} already exists in Supabase, skipping auth creation`);
      return { user: existingUser.user, created: false };
    }

    // Create user in Supabase Auth
    const { data: supabaseAuthData, error: authError } = await supabase.auth.admin.createUser({
      email: firebaseUser.email,
      email_confirm: true, // Mark email as confirmed
      password: generateTemporaryPassword(), // Generate random password (user will need to reset)
      user_metadata: {
        firebase_uid: firebaseUser.uid, // Store Firebase UID for reference
        full_name: profile?.full_name || firebaseUser.displayName || null,
      },
    });

    if (authError) {
      throw new Error(`Supabase Auth creation failed: ${authError.message}`);
    }

    if (!supabaseAuthData.user) {
      throw new Error('Supabase user creation returned no user');
    }

    console.log(`   ✅ Created Supabase Auth user: ${firebaseUser.email} (${supabaseAuthData.user.id})`);
    return { user: supabaseAuthData.user, created: true };
  } catch (error) {
    throw new Error(`Failed to create Supabase user: ${error.message}`);
  }
}

/**
 * Create profile in Supabase public.profiles table
 */
async function createSupabaseProfile(supabaseUser, firebaseUser, profile) {
  try {
    // Check if profile already exists
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', supabaseUser.id)
      .single();

    if (existingProfile) {
      console.log(`   ⏭️  Profile already exists for user ${supabaseUser.id}, skipping`);
      return { created: false };
    }

    // Create profile
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        user_id: supabaseUser.id,
        full_name: profile?.full_name || firebaseUser.displayName || null,
        department: profile?.department || null,
        phone: profile?.phone || null,
        avatar_url: profile?.avatar_url || null,
      });

    if (profileError) {
      throw new Error(`Profile creation failed: ${profileError.message}`);
    }

    console.log(`   ✅ Created profile for user: ${supabaseUser.id}`);
    return { created: true };
  } catch (error) {
    throw new Error(`Failed to create profile: ${error.message}`);
  }
}

/**
 * Create roles in Supabase public.user_roles table
 */
async function createSupabaseRoles(supabaseUser, roles) {
  try {
    if (!roles || roles.length === 0) {
      console.log(`   ⚠️  No roles found for user ${supabaseUser.id}, skipping roles`);
      return { created: false };
    }

    // Check existing roles
    const { data: existingRoles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', supabaseUser.id);

    const existingRoleValues = (existingRoles || []).map(r => r.role);

    // Filter out roles that already exist
    const rolesToInsert = roles.filter(role => !existingRoleValues.includes(role));

    if (rolesToInsert.length === 0) {
      console.log(`   ⏭️  All roles already exist for user ${supabaseUser.id}`);
      return { created: false };
    }

    // Insert roles (map Firebase roles to Supabase app_role enum)
    const roleMappings = {
      'admin': 'admin',
      'sales': 'sales',
      'design': 'design',
      'prepress': 'prepress',
      'production': 'production',
    };

    const validRoles = rolesToInsert
      .map(r => roleMappings[r])
      .filter(r => r !== undefined);

    if (validRoles.length === 0) {
      console.log(`   ⚠️  No valid roles to insert for user ${supabaseUser.id}`);
      return { created: false };
    }

    const roleInserts = validRoles.map(role => ({
      user_id: supabaseUser.id,
      role: role,
    }));

    const { error: rolesError } = await supabase
      .from('user_roles')
      .insert(roleInserts);

    if (rolesError) {
      throw new Error(`Roles creation failed: ${rolesError.message}`);
    }

    console.log(`   ✅ Created ${validRoles.length} role(s) for user: ${supabaseUser.id} (${validRoles.join(', ')})`);
    return { created: true };
  } catch (error) {
    throw new Error(`Failed to create roles: ${error.message}`);
  }
}

/**
 * Generate temporary password for migrated users
 */
function generateTemporaryPassword() {
  // Generate a secure random password
  // Users will need to reset their password after migration
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < 16; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

/**
 * Main migration function
 */
async function migrateUsers() {
  console.log('\n🚀 Starting Firebase to Supabase User Migration\n');
  console.log('='.repeat(60));

  try {
    // Step 1: Fetch Firebase users
    const firebaseUsers = await fetchFirebaseUsers();
    migrationStats.total = firebaseUsers.length;

    if (firebaseUsers.length === 0) {
      console.log('\n⚠️  No users found in Firebase. Exiting.');
      return;
    }

    // Step 2: Fetch profiles and roles from Firestore
    const userIds = firebaseUsers.map(u => u.uid);
    const [profiles, roles] = await Promise.all([
      fetchFirebaseProfiles(userIds),
      fetchFirebaseRoles(userIds),
    ]);

    // Step 3: Migrate each user
    console.log('\n📤 Migrating users to Supabase...\n');

    for (const firebaseUser of firebaseUsers) {
      const email = firebaseUser.email;
      if (!email) {
        console.log(`⚠️  Skipping user ${firebaseUser.uid} - no email`);
        migrationStats.skipped++;
        continue;
      }

      console.log(`\n📦 Migrating user: ${email} (Firebase UID: ${firebaseUser.uid})`);

      try {
        const profile = profiles[firebaseUser.uid];
        const userRoles = roles[firebaseUser.uid] || [];

        // Create Supabase Auth user
        const { user: supabaseUser, created: authCreated } = await createSupabaseUser(
          firebaseUser,
          profile,
          userRoles
        );

        if (!supabaseUser) {
          throw new Error('Supabase user creation returned null');
        }

        // Create profile
        await createSupabaseProfile(supabaseUser, firebaseUser, profile);

        // Create roles
        await createSupabaseRoles(supabaseUser, userRoles);

        migrationStats.successful++;
        console.log(`   ✅ Successfully migrated: ${email}`);

      } catch (error) {
        migrationStats.failed++;
        migrationStats.errors.push({ email, error: error.message });
        console.error(`   ❌ Failed to migrate ${email}: ${error.message}`);
      }
    }

    // Step 4: Print summary
    console.log('\n' + '='.repeat(60));
    console.log('\n📊 Migration Summary:');
    console.log(`   Total users: ${migrationStats.total}`);
    console.log(`   ✅ Successful: ${migrationStats.successful}`);
    console.log(`   ⏭️  Skipped: ${migrationStats.skipped}`);
    console.log(`   ❌ Failed: ${migrationStats.failed}`);

    if (migrationStats.errors.length > 0) {
      console.log('\n❌ Errors:');
      migrationStats.errors.forEach(({ email, error }) => {
        console.log(`   - ${email}: ${error}`);
      });
    }

    console.log('\n✅ Migration complete!\n');
    console.log('⚠️  IMPORTANT: Users will need to reset their passwords after migration.');
    console.log('   They should use the "Forgot Password" feature to set a new password.\n');

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
migrateUsers().catch(console.error);

