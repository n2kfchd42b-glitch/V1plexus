-- ════════════════════════════════════════
-- FIX: Workspace SELECT policy blocks INSERT RETURNING
--
-- When a user creates a workspace (INSERT ... .select().single()),
-- PostgREST returns 403 because the SELECT policy requires an active
-- membership — but no membership exists yet at INSERT time.
--
-- Fix: also allow selecting workspaces where owner_id = auth.uid()
-- so the RETURNING clause works immediately after INSERT.
-- ════════════════════════════════════════
DROP POLICY IF EXISTS "Users see their workspaces" ON workspaces;
CREATE POLICY "Users see their workspaces" ON workspaces
  FOR SELECT TO authenticated
  USING (
    owner_id = auth.uid()
    OR id IN (SELECT workspace_id FROM get_user_workspace_ids(auth.uid()))
  );
