
-- Create a public bucket for all uploads (profiles, portfolio, banners, certificates)
INSERT INTO storage.buckets (id, name, public)
VALUES ('uploads', 'uploads', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'uploads');

-- Allow anyone to view files (public bucket)
CREATE POLICY "Anyone can view uploaded files"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'uploads');

-- Allow authenticated users to update their own files
CREATE POLICY "Users can update own files"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'uploads' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow authenticated users to delete their own files
CREATE POLICY "Users can delete own files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'uploads' AND (storage.foldername(name))[1] = auth.uid()::text);
