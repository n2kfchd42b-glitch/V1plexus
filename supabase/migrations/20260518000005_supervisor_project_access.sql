-- ================================================================
-- STEP 1: Supervisor automatically gets viewer access to a
--         student's projects when an assignment is created,
--         and to any new project the student creates later.
-- ================================================================

-- ── Trigger 1: assignment created/activated → add supervisor to
--               all existing student projects ────────────────────

CREATE OR REPLACE FUNCTION sync_supervisor_project_access()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Add supervisor as viewer on every non-deleted project the student owns
  INSERT INTO project_members (project_id, user_id, role)
  SELECT p.id, NEW.supervisor_id, 'viewer'
  FROM   projects p
  WHERE  p.owner_id    = NEW.student_id
    AND  p.deleted_at  IS NULL
  ON CONFLICT (project_id, user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_supervisor_project_access ON supervisor_assignments;
CREATE TRIGGER trg_supervisor_project_access
  AFTER INSERT OR UPDATE OF status
  ON supervisor_assignments
  FOR EACH ROW
  WHEN (NEW.status = 'active')
  EXECUTE FUNCTION sync_supervisor_project_access();


-- ── Trigger 2: student creates a new project → add all their
--               active supervisors immediately ───────────────────

CREATE OR REPLACE FUNCTION add_supervisors_to_new_project()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO project_members (project_id, user_id, role)
  SELECT NEW.id, sa.supervisor_id, 'viewer'
  FROM   supervisor_assignments sa
  WHERE  sa.student_id = NEW.owner_id
    AND  sa.status     = 'active'
  ON CONFLICT (project_id, user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_add_supervisors_to_new_project ON projects;
CREATE TRIGGER trg_add_supervisors_to_new_project
  AFTER INSERT ON projects
  FOR EACH ROW
  EXECUTE FUNCTION add_supervisors_to_new_project();


-- ── Backfill: wire up all existing active assignments now ─────────

DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT supervisor_id, student_id
    FROM   supervisor_assignments
    WHERE  status = 'active'
  LOOP
    INSERT INTO project_members (project_id, user_id, role)
    SELECT p.id, rec.supervisor_id, 'viewer'
    FROM   projects p
    WHERE  p.owner_id   = rec.student_id
      AND  p.deleted_at IS NULL
    ON CONFLICT (project_id, user_id) DO NOTHING;
  END LOOP;
END;
$$;
