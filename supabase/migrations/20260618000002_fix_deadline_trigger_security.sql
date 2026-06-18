-- Fix: sync_chapter_deadline, sync_milestone_deadline, and
-- sync_thesis_completion_deadline were all missing SECURITY DEFINER.
-- The deadlines table has no INSERT/UPDATE policy for authenticated users
-- (all writes are intentionally trigger-only). Without SECURITY DEFINER the
-- triggers run as the calling student user, hit the RLS block, and roll back
-- the originating thesis_chapters / thesis_metadata insert entirely.

SET search_path = public;

-- ── Chapter deadline sync ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION sync_chapter_deadline()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner UUID;
BEGIN
  SELECT owner_id INTO v_owner FROM projects WHERE id = NEW.project_id;
  IF v_owner IS NULL THEN RETURN NEW; END IF;

  IF NEW.target_date IS NOT NULL THEN
    INSERT INTO deadlines
      (project_id, kind, source_type, source_id, target_at, owner_id, title)
    VALUES
      (NEW.project_id, 'chapter_due', 'thesis_chapter', NEW.id,
       NEW.target_date::timestamptz, v_owner,
       'Chapter: ' || NEW.title)
    ON CONFLICT (source_type, source_id) DO UPDATE
      SET target_at    = EXCLUDED.target_at,
          title        = EXCLUDED.title,
          satisfied_at = CASE
            WHEN NEW.status IN ('approved','locked') THEN deadlines.satisfied_at
            ELSE NULL
          END;
  END IF;

  IF NEW.status IN ('approved','locked') THEN
    UPDATE deadlines
       SET satisfied_at = COALESCE(satisfied_at, now()),
           satisfied_by = NEW.approved_by
     WHERE source_type = 'thesis_chapter'
       AND source_id   = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS thesis_chapters_sync_deadline ON thesis_chapters;
CREATE TRIGGER thesis_chapters_sync_deadline
  AFTER INSERT OR UPDATE OF target_date, status, title ON thesis_chapters
  FOR EACH ROW EXECUTE FUNCTION sync_chapter_deadline();


-- ── Milestone deadline sync ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION sync_milestone_deadline()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.due_date IS NOT NULL THEN
    INSERT INTO deadlines
      (project_id, kind, source_type, source_id, target_at, owner_id, title)
    VALUES
      (COALESCE(NEW.project_id, (SELECT id FROM projects WHERE owner_id = NEW.student_id ORDER BY created_at LIMIT 1)),
       'milestone_due', 'student_milestone', NEW.id,
       NEW.due_date::timestamptz, NEW.student_id,
       'Milestone: ' || NEW.title)
    ON CONFLICT (source_type, source_id) DO UPDATE
      SET target_at    = EXCLUDED.target_at,
          title        = EXCLUDED.title,
          satisfied_at = CASE
            WHEN NEW.status = 'approved' THEN deadlines.satisfied_at
            ELSE NULL
          END;
  END IF;

  IF NEW.status = 'approved' THEN
    UPDATE deadlines
       SET satisfied_at = COALESCE(satisfied_at, now()),
           satisfied_by = NEW.approved_by
     WHERE source_type = 'student_milestone'
       AND source_id   = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS student_milestones_sync_deadline ON student_milestones;
CREATE TRIGGER student_milestones_sync_deadline
  AFTER INSERT OR UPDATE OF due_date, status, title, project_id ON student_milestones
  FOR EACH ROW EXECUTE FUNCTION sync_milestone_deadline();


-- ── Thesis completion deadline sync ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION sync_thesis_completion_deadline()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner UUID;
BEGIN
  SELECT owner_id INTO v_owner FROM projects WHERE id = NEW.project_id;
  IF v_owner IS NULL THEN RETURN NEW; END IF;

  IF NEW.expected_completion IS NOT NULL THEN
    INSERT INTO deadlines
      (project_id, kind, source_type, source_id, target_at, owner_id, title)
    VALUES
      (NEW.project_id, 'thesis_completion', 'thesis_metadata', NEW.id,
       NEW.expected_completion::timestamptz, v_owner,
       COALESCE(NEW.thesis_title, 'Thesis completion'))
    ON CONFLICT (source_type, source_id) DO UPDATE
      SET target_at    = EXCLUDED.target_at,
          title        = EXCLUDED.title,
          satisfied_at = CASE
            WHEN NEW.lifecycle_state IN ('approved','archived') THEN deadlines.satisfied_at
            ELSE NULL
          END;
  END IF;

  IF NEW.lifecycle_state IN ('approved','archived') THEN
    UPDATE deadlines
       SET satisfied_at = COALESCE(satisfied_at, now())
     WHERE source_type = 'thesis_metadata'
       AND source_id   = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS thesis_metadata_sync_completion_deadline ON thesis_metadata;
CREATE TRIGGER thesis_metadata_sync_completion_deadline
  AFTER INSERT OR UPDATE OF expected_completion, lifecycle_state, thesis_title ON thesis_metadata
  FOR EACH ROW EXECUTE FUNCTION sync_thesis_completion_deadline();
