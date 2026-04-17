-- ============================================================================
-- FIX verification_tokens SELECT RLS FOR PROJECT OWNERS
--
-- The existing policy only checked project_members, excluding the project owner
-- (stored in projects.owner_id). Owners could insert tokens (creator_insert_token
-- passes) but could not read them back, so the token display was always empty.
-- ============================================================================

SET search_path = public;

DROP POLICY IF EXISTS "project_members_select_tokens" ON public.verification_tokens;

CREATE POLICY "project_access_select_tokens"
  ON public.verification_tokens FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = verification_tokens.project_id
        AND p.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = verification_tokens.project_id
        AND pm.user_id = auth.uid()
    )
  );
