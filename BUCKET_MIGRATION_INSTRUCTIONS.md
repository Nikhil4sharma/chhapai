# Storage Bucket Migration Instructions

## Problem
File download aur preview nahi ho raha kyunki `order-files` bucket exist nahi karta ya properly configured nahi hai.

## Solution
Migration file create ho chuki hai jo bucket ensure karegi. Ab Supabase Dashboard me SQL run karna hoga.

## Steps to Fix:

### Option 1: Supabase Dashboard (Recommended)

1. **Supabase Dashboard me jao:**
   - https://supabase.com/dashboard
   - Apna project select karo

2. **SQL Editor me jao:**
   - Left sidebar me **SQL Editor** click karo
   - **New Query** create karo

3. **Ye SQL copy-paste karo aur run karo:**

```sql
-- Ensure order-files bucket exists and is properly configured
-- This migration ensures the bucket exists even if previous migrations failed

-- Create bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('order-files', 'order-files', false)
ON CONFLICT (id) DO NOTHING;

-- Make bucket private (for security)
UPDATE storage.buckets 
SET public = false 
WHERE id = 'order-files';

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Anyone can view order files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view order files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload order files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update order files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete order files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their uploaded files" ON storage.objects;

-- Create policies for private bucket access
CREATE POLICY "Authenticated users can view order files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'order-files');

CREATE POLICY "Authenticated users can upload order files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'order-files');

CREATE POLICY "Authenticated users can update order files"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'order-files');

CREATE POLICY "Authenticated users can delete order files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'order-files');
```

4. **Run button click karo**
5. **Success message check karo**

### Option 2: Verify Bucket Exists

Agar bucket already exist karta hai, to verify karo:

1. Supabase Dashboard → **Storage** section
2. Check karo ki `order-files` bucket hai ya nahi
3. Agar nahi hai, to manually create karo:
   - **New bucket** click karo
   - Name: `order-files`
   - Public: **False** (private bucket)
   - Create karo

## After Migration:

1. **App reload karo**
2. **File preview test karo** - ab signed URL use hoga
3. **File download test karo** - ab properly work karega
4. **Thumbnail preview test karo** - images properly show hongi

## Important Notes:

- Bucket **private** hai (security ke liye)
- Signed URLs use ho rahe hain (1 hour validity)
- Authenticated users hi files access kar sakte hain
- Migration file: `supabase/migrations/20251219010000_ensure_order_files_bucket.sql`

