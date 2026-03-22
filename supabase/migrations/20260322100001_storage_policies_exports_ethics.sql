-- ════════════════════════════════════════
-- STORAGE RLS POLICIES FOR document-exports BUCKET
-- ════════════════════════════════════════

CREATE POLICY "Authenticated users can upload document exports"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'document-exports');

CREATE POLICY "Authenticated users can read document exports"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'document-exports');

CREATE POLICY "Authenticated users can update document exports"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'document-exports');

CREATE POLICY "Authenticated users can delete document exports"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'document-exports');

-- ════════════════════════════════════════
-- STORAGE RLS POLICIES FOR ethics-documents BUCKET
-- ════════════════════════════════════════

CREATE POLICY "Authenticated users can upload ethics documents"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'ethics-documents');

CREATE POLICY "Authenticated users can read ethics documents"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'ethics-documents');

CREATE POLICY "Authenticated users can update ethics documents"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'ethics-documents');

CREATE POLICY "Authenticated users can delete ethics documents"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'ethics-documents');
