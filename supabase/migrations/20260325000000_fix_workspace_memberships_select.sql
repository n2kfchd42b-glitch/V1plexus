-- ════════════════════════════════════════
-- Fix workspace_memberships SELECT 500 error
--
-- The existing policy calls get_user_workspace_ids() which sub-selects
-- workspace_memberships, creating a planning-time recursion that causes
-- PostgREST to return 500 even though the function is SECURITY DEFINER.
--
-- Fix: add user_id = auth.uid() as a direct short-circuit so a user's
-- own memberships resolve without invoking the helper at all.
-- ════════════════════════════════════════
DROP POLICY IF EXISTS "Members see workspace memberships" ON workspace_memberships;
CREATE POLICY "Members see workspace memberships" ON workspace_memberships
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR workspace_id IN (SELECT workspace_id FROM get_user_workspace_ids(auth.uid()))
  );
