-- ══════════════════════════════════════════════════════════════════
-- STORAGE: avatars + credentials buckets with RLS policies
-- Fixes: avatar uploads and credential document uploads on profile page
-- ══════════════════════════════════════════════════════════════════

-- ── 1. Create avatars bucket ──────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  5242880, -- 5 MB
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- ── 2. RLS policies for avatars bucket ───────────────────────────
-- Users can upload only into their own folder (auth.uid()::text = first path segment)
CREATE POLICY "Users can upload their own avatar"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Anyone authenticated can view all avatars (profiles are public)
CREATE POLICY "Authenticated users can view avatars"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'avatars');

-- Users can update/replace only their own avatar
CREATE POLICY "Users can update their own avatar"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Users can delete only their own avatar
CREATE POLICY "Users can delete their own avatar"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ── 3. Create credentials bucket ─────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'credentials',
  'credentials',
  false, -- private — not publicly accessible
  10485760, -- 10 MB
  ARRAY['application/pdf', 'image/jpeg', 'image/png']
)
ON CONFLICT (id) DO NOTHING;

-- ── 4. RLS policies for credentials bucket ───────────────────────
-- Users can upload only into their own folder
CREATE POLICY "Users can upload their own credentials"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'credentials'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Users can view only their own credential files
CREATE POLICY "Users can view their own credentials"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'credentials'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Users can delete their own credential files
CREATE POLICY "Users can delete their own credentials"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'credentials'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
