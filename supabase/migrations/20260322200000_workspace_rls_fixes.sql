-- ════════════════════════════════════════
-- FIX 1: Add missing onboarding_completed column
-- ════════════════════════════════════════
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE;

-- ════════════════════════════════════════
-- FIX 2: SECURITY DEFINER helper to break RLS recursion
-- Queries workspace_memberships bypassing RLS so policies
-- on workspaces/workspace_memberships don't recurse into themselves.
-- ════════════════════════════════════════
CREATE OR REPLACE FUNCTION get_user_workspace_ids(uid UUID)
RETURNS TABLE(workspace_id UUID)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT workspace_id
  FROM workspace_memberships
  WHERE user_id = uid AND status = 'active';
$$;

-- Helper: check if a user has a given role in a workspace
CREATE OR REPLACE FUNCTION user_workspace_role(uid UUID, wsid UUID, roles TEXT[])
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM workspace_memberships
    WHERE user_id = uid
      AND workspace_id = wsid
      AND role = ANY(roles)
      AND status = 'active'
  );
$$;

-- ════════════════════════════════════════
-- FIX 3: Rewrite workspaces RLS using helpers (no recursion)
-- ════════════════════════════════════════
DROP POLICY IF EXISTS "Users see their workspaces" ON workspaces;
CREATE POLICY "Users see their workspaces" ON workspaces
  FOR SELECT TO authenticated
  USING (id IN (SELECT workspace_id FROM get_user_workspace_ids(auth.uid())));

DROP POLICY IF EXISTS "Users can insert their own workspace" ON workspaces;
CREATE POLICY "Users can insert their own workspace" ON workspaces
  FOR INSERT TO authenticated
  WITH CHECK (
    owner_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Owners and workspace admins can update workspace settings
DROP POLICY IF EXISTS "Owners and admins can update workspaces" ON workspaces;
CREATE POLICY "Owners and admins can update workspaces" ON workspaces
  FOR UPDATE TO authenticated
  USING (
    owner_id = auth.uid()
    OR user_workspace_role(auth.uid(), id, ARRAY['owner', 'admin'])
  );

-- Only owners can delete their workspace
DROP POLICY IF EXISTS "Owners can delete workspaces" ON workspaces;
CREATE POLICY "Owners can delete workspaces" ON workspaces
  FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

-- ════════════════════════════════════════
-- FIX 4: Rewrite workspace_memberships RLS using helpers
-- ════════════════════════════════════════
DROP POLICY IF EXISTS "Members see workspace memberships" ON workspace_memberships;
CREATE POLICY "Members see workspace memberships" ON workspace_memberships
  FOR SELECT TO authenticated
  USING (
    workspace_id IN (SELECT workspace_id FROM get_user_workspace_ids(auth.uid()))
  );

DROP POLICY IF EXISTS "Users can insert their own membership" ON workspace_memberships;
CREATE POLICY "Users can insert their own membership" ON workspace_memberships
  FOR INSERT TO authenticated
  WITH CHECK (
    -- Users can add themselves, or workspace admins can add anyone
    user_id = auth.uid()
    OR user_workspace_role(auth.uid(), workspace_id, ARRAY['owner', 'admin'])
  );

-- Workspace admins can update roles/status
DROP POLICY IF EXISTS "Admins can update workspace memberships" ON workspace_memberships;
CREATE POLICY "Admins can update workspace memberships" ON workspace_memberships
  FOR UPDATE TO authenticated
  USING (
    user_workspace_role(auth.uid(), workspace_id, ARRAY['owner', 'admin'])
  );

-- Users can leave (delete their own membership); admins can remove others
DROP POLICY IF EXISTS "Users can leave or admins can remove memberships" ON workspace_memberships;
CREATE POLICY "Users can leave or admins can remove memberships" ON workspace_memberships
  FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR user_workspace_role(auth.uid(), workspace_id, ARRAY['owner', 'admin'])
  );

-- ════════════════════════════════════════
-- FIX 5: workspace_invitations UPDATE/DELETE policies
-- ════════════════════════════════════════

-- Inviters can update (cancel/resend); invitees can update status to accepted/declined
DROP POLICY IF EXISTS "Inviters or invitees can update workspace invitations" ON workspace_invitations;
CREATE POLICY "Inviters or invitees can update workspace invitations" ON workspace_invitations
  FOR UPDATE TO authenticated
  USING (
    invited_by = auth.uid()
    OR (email = (SELECT email FROM profiles WHERE id = auth.uid()))
  );

-- Inviters and workspace admins can delete invitations
DROP POLICY IF EXISTS "Inviters and admins can delete workspace invitations" ON workspace_invitations;
CREATE POLICY "Inviters and admins can delete workspace invitations" ON workspace_invitations
  FOR DELETE TO authenticated
  USING (
    invited_by = auth.uid()
    OR user_workspace_role(auth.uid(), workspace_id, ARRAY['owner', 'admin'])
  );

-- Workspace admins can insert invitations (not just inviters)
DROP POLICY IF EXISTS "Admins can insert workspace invitations" ON workspace_invitations;
CREATE POLICY "Admins can insert workspace invitations" ON workspace_invitations
  FOR INSERT TO authenticated
  WITH CHECK (
    invited_by = auth.uid()
    AND user_workspace_role(auth.uid(), workspace_id, ARRAY['owner', 'admin'])
  );

-- ════════════════════════════════════════
-- FIX 6: project_invitations UPDATE/DELETE policies
-- ════════════════════════════════════════

-- Inviters can update (cancel/resend); invitees can update status
DROP POLICY IF EXISTS "Inviters or invitees can update project invitations" ON project_invitations;
CREATE POLICY "Inviters or invitees can update project invitations" ON project_invitations
  FOR UPDATE TO authenticated
  USING (
    invited_by = auth.uid()
    OR (email = (SELECT email FROM profiles WHERE id = auth.uid()))
  );

-- Inviters and project owners can delete invitations
DROP POLICY IF EXISTS "Inviters and owners can delete project invitations" ON project_invitations;
CREATE POLICY "Inviters and owners can delete project invitations" ON project_invitations
  FOR DELETE TO authenticated
  USING (
    invited_by = auth.uid()
    OR project_id IN (SELECT id FROM projects WHERE owner_id = auth.uid())
  );

-- ════════════════════════════════════════
-- FIX 7: supervisor_assignments — add INSERT/UPDATE/DELETE
-- ════════════════════════════════════════
DROP POLICY IF EXISTS "Admins can insert supervisor assignments" ON supervisor_assignments;
CREATE POLICY "Admins can insert supervisor assignments" ON supervisor_assignments
  FOR INSERT TO authenticated
  WITH CHECK (
    user_workspace_role(auth.uid(), workspace_id, ARRAY['owner', 'admin', 'department_head'])
  );

DROP POLICY IF EXISTS "Admins can update supervisor assignments" ON supervisor_assignments;
CREATE POLICY "Admins can update supervisor assignments" ON supervisor_assignments
  FOR UPDATE TO authenticated
  USING (
    user_workspace_role(auth.uid(), workspace_id, ARRAY['owner', 'admin', 'department_head'])
  );

DROP POLICY IF EXISTS "Admins can delete supervisor assignments" ON supervisor_assignments;
CREATE POLICY "Admins can delete supervisor assignments" ON supervisor_assignments
  FOR DELETE TO authenticated
  USING (
    user_workspace_role(auth.uid(), workspace_id, ARRAY['owner', 'admin', 'department_head'])
  );
