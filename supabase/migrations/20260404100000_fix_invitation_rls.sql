-- ════════════════════════════════════════
-- Fix workspace_invitations INSERT policy
-- Expand allowed roles: owner, admin, department_head, supervisor, pi
-- (Previous policy only allowed owner/admin)
-- ════════════════════════════════════════
DROP POLICY IF EXISTS "Admins can insert workspace invitations" ON workspace_invitations;
CREATE POLICY "Members can insert workspace invitations" ON workspace_invitations
  FOR INSERT TO authenticated
  WITH CHECK (
    invited_by = auth.uid()
    AND user_workspace_role(
      auth.uid(),
      workspace_id,
      ARRAY['owner', 'admin', 'department_head', 'supervisor', 'pi']
    )
  );

-- ════════════════════════════════════════
-- Fix project_invitations INSERT policy
-- Old policy only checked invited_by = auth.uid() — no ownership check.
-- New policy requires the inviter to be a member of the project.
-- ════════════════════════════════════════
DROP POLICY IF EXISTS "Project owners can insert project invitations" ON project_invitations;
DROP POLICY IF EXISTS "Project members can insert project invitations" ON project_invitations;
CREATE POLICY "Project members can insert project invitations" ON project_invitations
  FOR INSERT TO authenticated
  WITH CHECK (
    invited_by = auth.uid()
    AND project_id IN (
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
    )
  );
