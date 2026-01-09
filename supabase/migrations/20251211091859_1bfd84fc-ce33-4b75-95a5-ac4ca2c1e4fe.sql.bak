-- Drop and recreate the storage delete policy with correct name
DROP POLICY IF EXISTS "Users can delete their own files" ON storage.objects;

CREATE POLICY "Users can delete their uploaded files"
ON storage.objects FOR DELETE
USING (bucket_id = 'order-files' AND auth.uid()::text = (storage.foldername(name))[1]);