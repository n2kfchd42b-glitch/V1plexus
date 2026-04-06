-- ════════════════════════════════════════
-- Fix: Allow invited users to look up their invitations by token
-- This allows users to accept invitations even before they're project members
-- ════════════════════════════════════════

-- Add a policy allowing any authenticated user to read project invitations
-- This matches the existing workspace_invitations policy
-- Users can look up their invitations by token when accepting
DROP POLICY IF EXISTS "Project members see invitations" ON project_invitations;

CREATE POLICY "Project members see invitations" ON project_invitations
  FOR SELECT TO authenticated USING (
    -- Project members can see all invitations for their project
    project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid())
    OR project_id IN (SELECT id FROM projects WHERE owner_id = auth.uid())
  );

-- New policy: Allow any authenticated user to look up invitations by token
CREATE POLICY "Authenticated users can read project invitations" ON project_invitations
  FOR SELECT TO authenticated USING (true);


