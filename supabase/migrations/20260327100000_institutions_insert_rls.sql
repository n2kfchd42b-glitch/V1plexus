-- ════════════════════════════════════════════════════════════════
-- Fix: institutions INSERT returns 403.
--
-- Root cause: the only institutions INSERT policy lives in
-- 006_phase6_search_export.sql, which is a non-timestamp file and
-- was therefore never applied by the Supabase CLI — only the
-- timestamp-format migrations are tracked and pushed.
--
-- Fix: add the INSERT policy via a tracked migration so any
-- authenticated user can create an institution (required for the
-- institution setup flow).
-- ════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Authenticated users can create institutions" ON institutions;
CREATE POLICY "Authenticated users can create institutions"
  ON institutions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);
