-- ════════════════════════════════════════
-- Fix project_invitations RLS: include project owner
-- Previous policies only checked project_members, excluding the project owner
-- (who is stored in projects.owner_id, not project_members).
-- ════════════════════════════════════════

-- SELECT: project members OR the project owner can view invitations
DROP POLICY IF EXISTS "Project members see invitations" ON project_invitations;
CREATE POLICY "Project members see invitations" ON project_invitations
  FOR SELECT TO authenticated USING (
    project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid())
    OR project_id IN (SELECT id FROM projects WHERE owner_id = auth.uid())
  );

-- INSERT: project members OR the project owner can create invitations
DROP POLICY IF EXISTS "Project members can insert project invitations" ON project_invitations;
CREATE POLICY "Project members can insert project invitations" ON project_invitations
  FOR INSERT TO authenticated
  WITH CHECK (
    invited_by = auth.uid()
    AND (
      project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid())
      OR project_id IN (SELECT id FROM projects WHERE owner_id = auth.uid())
    )
  );

-- UPDATE: inviters, project members, or project owner can update (cancel/accept)
DROP POLICY IF EXISTS "Inviters or invitees can update project invitations" ON project_invitations;
CREATE POLICY "Inviters or invitees can update project invitations" ON project_invitations
  FOR UPDATE TO authenticated
  USING (
    invited_by = auth.uid()
    OR project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid())
    OR project_id IN (SELECT id FROM projects WHERE owner_id = auth.uid())
  );
