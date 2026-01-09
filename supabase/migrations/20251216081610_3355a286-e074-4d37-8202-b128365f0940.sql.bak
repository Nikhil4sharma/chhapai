-- Fix: Make order-files storage bucket private
UPDATE storage.buckets SET public = false WHERE id = 'order-files';

-- Drop all existing policies on storage.objects for order-files bucket
DROP POLICY IF EXISTS "Authenticated users can view files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete files" ON storage.objects;
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can upload" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can delete" ON storage.objects;

-- Create new policies for private bucket access
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