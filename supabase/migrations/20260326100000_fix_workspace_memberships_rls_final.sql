-- ════════════════════════════════════════════════════════════════
-- Definitive fix for workspace_memberships SELECT 500 error.
--
-- Root cause: every previous attempt still called get_user_workspace_ids()
-- inside the workspace_memberships SELECT policy.  That function queries
-- workspace_memberships, so PostgreSQL detects the mutual recursion at
-- plan time and raises a 500 (42P17) regardless of SECURITY DEFINER.
--
-- Fix: remove ALL references to workspace_memberships from its own
-- SELECT policy.  Use only:
--   • user_id = auth.uid()  — a user always sees their own rows
--   • workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid())
--     — workspace owners can see every member (queries workspaces, not
--       workspace_memberships — zero recursion risk)
-- ════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Members see workspace memberships" ON workspace_memberships;
CREATE POLICY "Members see workspace memberships" ON workspace_memberships
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR workspace_id IN (
      SELECT id FROM workspaces WHERE owner_id = auth.uid()
    )
  );
