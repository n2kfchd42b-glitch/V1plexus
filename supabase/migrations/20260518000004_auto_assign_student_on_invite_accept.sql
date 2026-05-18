-- When a student accepts a workspace invitation that includes a supervisor_id,
-- automatically create the supervisor_assignment so the student appears in
-- the supervisor's cohort immediately after accepting.

CREATE OR REPLACE FUNCTION auto_create_supervisor_assignment()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Only act on student memberships that carry a supervisor reference
  IF NEW.role = 'student' AND NEW.supervisor_id IS NOT NULL AND NEW.status = 'active' THEN
    INSERT INTO supervisor_assignments (
      workspace_id,
      supervisor_id,
      student_id,
      role,
      status,
      assigned_at
    )
    VALUES (
      NEW.workspace_id,
      NEW.supervisor_id,
      NEW.user_id,
      'primary',
      'active',
      now()
    )
    ON CONFLICT ON CONSTRAINT supervisor_assignments_unique_role DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_assign_student ON workspace_memberships;
CREATE TRIGGER trg_auto_assign_student
  AFTER INSERT OR UPDATE OF status, supervisor_id
  ON workspace_memberships
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_supervisor_assignment();
