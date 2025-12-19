// Firebase is being phased out - using Supabase only
// This file provides stubs to prevent import errors
// All Firebase functionality should be migrated to Supabase

// Create mock objects to prevent errors
const createMockFirestore = () => ({
  collection: () => ({ doc: () => ({ get: () => Promise.resolve({ exists: false }), set: () => Promise.resolve(), update: () => Promise.resolve(), delete: () => Promise.resolve() }) }),
  doc: () => ({ get: () => Promise.resolve({ exists: false }), set: () => Promise.resolve(), update: () => Promise.resolve(), delete: () => Promise.resolve() }),
  query: () => ({}),
  where: () => ({}),
  orderBy: () => ({}),
  limit: () => ({}),
  getDocs: () => Promise.resolve({ docs: [], empty: true }),
  onSnapshot: () => () => {},
  Timestamp: { now: () => ({ toDate: () => new Date() }) },
});

const createMockStorage = () => ({
  ref: () => ({ put: () => Promise.resolve(), getDownloadURL: () => Promise.resolve('') }),
  uploadBytes: () => Promise.resolve({}),
  getDownloadURL: () => Promise.resolve(''),
});

// Export mock objects
export const auth = null;
export const db = createMockFirestore() as any;
export const storage = createMockStorage() as any;
export default null;

console.warn('Firebase is disabled - using Supabase only. Please migrate all Firebase dependencies to Supabase.');

