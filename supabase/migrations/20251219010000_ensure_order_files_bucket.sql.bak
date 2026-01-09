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

