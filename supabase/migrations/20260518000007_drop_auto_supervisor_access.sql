-- ================================================================
-- Remove automatic supervisor-to-all-projects access.
-- Supervisors must now be invited to individual projects by the
-- student. This gives students control over who sees what.
-- ================================================================

-- Drop the trigger that fired when a supervisor assignment was created
DROP TRIGGER IF EXISTS trg_supervisor_project_access ON supervisor_assignments;
DROP FUNCTION IF EXISTS sync_supervisor_project_access();

-- Drop the trigger that fired when a student created a new project
DROP TRIGGER IF EXISTS trg_add_supervisors_to_new_project ON projects;
DROP FUNCTION IF EXISTS add_supervisors_to_new_project();

-- Remove all auto-added supervisor memberships that were inserted by
-- the old triggers. We identify them as project_members rows where
-- the user appears as an active supervisor in supervisor_assignments.
DELETE FROM project_members pm
WHERE pm.role = 'viewer'
  AND EXISTS (
    SELECT 1 FROM supervisor_assignments sa
    WHERE sa.supervisor_id = pm.user_id
      AND sa.status = 'active'
  );
