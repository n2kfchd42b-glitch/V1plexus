-- The CHECK constraint on supervisor_assignments.status was defined as
--   CHECK (status IN ('active', 'ended', 'transferred'))
-- in 000_workspace_overhaul.sql. But the student-initiated request path at
-- /api/supervisor/request inserts rows with status='pending', and the PATCH
-- accept flow transitions pending → active. That insert has been failing
-- the check constraint silently — the live data only contains rows created
-- by the SECURITY DEFINER auto-assign trigger (which always inserts active).
--
-- Add 'pending' to the allowed values so student-initiated requests succeed.

ALTER TABLE supervisor_assignments
  DROP CONSTRAINT IF EXISTS supervisor_assignments_status_check;

ALTER TABLE supervisor_assignments
  ADD CONSTRAINT supervisor_assignments_status_check
    CHECK (status IN ('pending', 'active', 'ended', 'transferred'));
