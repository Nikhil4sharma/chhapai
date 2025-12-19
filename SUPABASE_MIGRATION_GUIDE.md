# Firebase se Supabase Migration Guide

## 🎯 Overview
Yeh guide Firebase se Supabase migration ke liye hai. Supabase PostgreSQL database use karta hai jo Firebase Firestore se better hai quota limits ke liye.

## 📋 Prerequisites

1. **Supabase Project Setup**
   - Project ID: `hswgdeldouyclpeqbbgq`
   - Supabase Dashboard: https://supabase.com/dashboard/project/hswgdeldouyclpeqbbgq

2. **Environment Variables**
   - `.env` file mein add karo:
   ```env
   VITE_SUPABASE_URL=https://hswgdeldouyclpeqbbgq.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key-here
   ```

3. **Supabase Dashboard se Keys**
   - Supabase Dashboard > Settings > API
   - `URL` aur `anon public` key copy karo

## 🔄 Migration Steps

### Step 1: Database Setup
Supabase migrations already ready hain `supabase/migrations/` folder mein. Run karo:

```bash
# Supabase CLI install karo (agar nahi hai)
npm install -g supabase

# Login karo
supabase login

# Link project
supabase link --project-ref hswgdeldouyclpeqbbgq

# Migrations apply karo
supabase db push
```

### Step 2: Code Migration Status

#### ✅ Completed
- [x] Supabase client config (`src/integrations/supabase/client.ts`)
- [x] Project ID updated

#### 🔄 In Progress
- [ ] AuthContext migration
- [ ] OrderContext migration
- [ ] WorkLogContext migration
- [ ] Notifications hook migration
- [ ] Storage operations migration

### Step 3: Key Differences

#### Firebase vs Supabase

**Firebase Firestore:**
```typescript
import { collection, getDocs } from 'firebase/firestore';
const snapshot = await getDocs(collection(db, 'orders'));
const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
```

**Supabase:**
```typescript
import { supabase } from '@/integrations/supabase/client';
const { data: orders, error } = await supabase
  .from('orders')
  .select('*');
```

**Real-time Listeners:**

**Firebase:**
```typescript
onSnapshot(collection(db, 'orders'), (snapshot) => {
  // handle changes
});
```

**Supabase:**
```typescript
supabase
  .channel('orders')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
    // handle changes
  })
  .subscribe();
```

**Storage:**

**Firebase:**
```typescript
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
const storageRef = ref(storage, `files/${fileName}`);
await uploadBytes(storageRef, file);
const url = await getDownloadURL(storageRef);
```

**Supabase:**
```typescript
const { data, error } = await supabase.storage
  .from('order-files')
  .upload(fileName, file);
const { data: { publicUrl } } = supabase.storage
  .from('order-files')
  .getPublicUrl(fileName);
```

## 🚀 Next Steps

1. **Environment Variables Setup**
   - `.env` file create karo
   - Supabase URL aur Anon Key add karo

2. **Database Migrations**
   - Supabase CLI se migrations run karo
   - Verify karo ki sab tables create ho gaye

3. **Code Migration**
   - Contexts ko one by one migrate karo
   - Test karo har step ke baad

4. **Storage Bucket Setup**
   - Supabase Dashboard > Storage
   - `order-files` bucket create karo
   - Public access enable karo (agar needed)

## 📝 Notes

- Supabase PostgreSQL use karta hai, jo SQL queries support karta hai
- Real-time updates ke liye Supabase Realtime use karo
- Storage ke liye Supabase Storage use karo (S3 compatible)
- Row Level Security (RLS) policies setup karo Supabase Dashboard mein

## ⚠️ Important

Migration ke baad:
1. Firebase dependencies remove karo (optional)
2. Old Firebase config files remove karo (optional)
3. Test thoroughly karo sab features
4. Production deploy se pehle staging mein test karo


