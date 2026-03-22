-- ════════════════════════════════════════
-- STORAGE RLS POLICIES FOR datasets BUCKET
-- ════════════════════════════════════════
-- The datasets bucket was created with public=false but no RLS policies,
-- causing all uploads/downloads to fail with 400.

-- Allow authenticated users to upload files to datasets bucket
CREATE POLICY "Authenticated users can upload dataset files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'datasets');

-- Allow authenticated users to read/download dataset files
CREATE POLICY "Authenticated users can read dataset files"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'datasets');

-- Allow authenticated users to update (upsert) dataset files
CREATE POLICY "Authenticated users can update dataset files"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'datasets');

-- Allow authenticated users to delete dataset files
CREATE POLICY "Authenticated users can delete dataset files"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'datasets');

-- Same policies for chart-thumbnails bucket
CREATE POLICY "Authenticated users can upload chart thumbnails"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'chart-thumbnails');

CREATE POLICY "Authenticated users can read chart thumbnails"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'chart-thumbnails');
