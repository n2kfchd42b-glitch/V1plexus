-- Allow students and supervisors to self-serve their own supervisor_assignments.
--
-- Prior policies (from 20260322200000_workspace_rls_fixes.sql) only granted
-- INSERT/UPDATE/DELETE to workspace admins, which meant the student-initiated
-- request flow at /api/supervisor/request failed with an RLS violation for
-- anyone who wasn't also an admin of the workspace. The
-- auto_create_supervisor_assignment() trigger has been bypassing RLS via
-- SECURITY DEFINER, which hid the bug for invite-acceptance writes.

-- INSERT: students can request a supervisor for themselves.
DROP POLICY IF EXISTS "Students can request supervisors" ON supervisor_assignments;
CREATE POLICY "Students can request supervisors" ON supervisor_assignments
  FOR INSERT TO authenticated
  WITH CHECK (
    student_id = auth.uid()
    AND assigned_by = auth.uid()
    AND status = 'pending'
  );

-- UPDATE: either party can update their own row (accept, decline, end, change role).
DROP POLICY IF EXISTS "Parties can update their own assignment" ON supervisor_assignments;
CREATE POLICY "Parties can update their own assignment" ON supervisor_assignments
  FOR UPDATE TO authenticated
  USING (supervisor_id = auth.uid() OR student_id = auth.uid())
  WITH CHECK (supervisor_id = auth.uid() OR student_id = auth.uid());

-- DELETE: either party can hard-delete the row (used for cancelling a pending
-- request — ending an active relationship goes through UPDATE → status='ended').
DROP POLICY IF EXISTS "Parties can delete their own assignment" ON supervisor_assignments;
CREATE POLICY "Parties can delete their own assignment" ON supervisor_assignments
  FOR DELETE TO authenticated
  USING (supervisor_id = auth.uid() OR student_id = auth.uid());
