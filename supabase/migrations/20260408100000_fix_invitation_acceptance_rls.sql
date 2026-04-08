-- ════════════════════════════════════════
-- Fix: Allow invitees to accept/decline their own project invitations
-- The existing UPDATE policy only covers inviters and existing project members.
-- This adds a direct email-based check (same pattern as workspace_invitations)
-- so the invitee can mark the invitation accepted even before project_members
-- reflects their new row.
-- ════════════════════════════════════════

-- Drop and rebuild the UPDATE policy to include the invitee
DROP POLICY IF EXISTS "Inviters or invitees can update project invitations" ON project_invitations;

CREATE POLICY "Inviters or invitees can update project invitations" ON project_invitations
  FOR UPDATE TO authenticated
  USING (
    invited_by = auth.uid()
    OR email = (SELECT email FROM profiles WHERE id = auth.uid())
    OR project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid())
    OR project_id IN (SELECT id FROM projects WHERE owner_id = auth.uid())
  )
  WITH CHECK (
    status IN ('accepted', 'declined', 'expired')
    OR invited_by = auth.uid()
    OR project_id IN (SELECT id FROM projects WHERE owner_id = auth.uid())
  );
