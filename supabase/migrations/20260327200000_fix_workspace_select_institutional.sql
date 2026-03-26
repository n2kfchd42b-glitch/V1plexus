-- ════════════════════════════════════════════════════════════════
-- Fix: workspace SELECT policy doesn't cover institutional workspaces
-- after creation.
--
-- The current policy requires owner_id = auth.uid() or active
-- membership via get_user_workspace_ids(). Institutional workspaces
-- have owner_id = NULL, so they're only visible through membership.
-- This is fine for normal access (membership exists), but the INSERT
-- RETURNING clause fails at creation time (no membership yet).
--
-- The form now generates IDs client-side to avoid RETURNING, so this
-- migration just ensures the SELECT policy uses the safe SECURITY
-- DEFINER function and covers both workspace types properly.
-- ════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Users see their workspaces" ON workspaces;
DROP POLICY IF EXISTS "Users see their own workspaces" ON workspaces;

CREATE POLICY "Users see their workspaces" ON workspaces
  FOR SELECT TO authenticated
  USING (
    owner_id = auth.uid()
    OR id IN (SELECT workspace_id FROM get_user_workspace_ids(auth.uid()))
  );
