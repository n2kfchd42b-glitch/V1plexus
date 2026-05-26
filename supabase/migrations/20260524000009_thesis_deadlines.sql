-- ════════════════════════════════════════════════════════════════════════════
-- THESIS DEADLINES + REMINDER LEDGER
--
-- Unified deadline tracking that the cron sweep reads from. Source rows
-- (chapters, milestones, thesis completion) auto-create deadline rows via
-- triggers, and auto-mark them satisfied when the source advances out of
-- the open state. The application never inserts deadlines directly except
-- for explicit 'custom' rows the admin UI might add later.
--
-- deadline_reminders is the idempotency ledger — a unique constraint on
-- (deadline_id, offset_label) means the same 7d reminder fires once even
-- if the cron sweep runs more than once on the same day.
--
-- escalation_user_id is intentionally NULL — resolving "who is the
-- coordinator" at deadline-create time would denormalize a moving target.
-- The sweep resolves it at escalation time from workspace_memberships.
-- ════════════════════════════════════════════════════════════════════════════

SET search_path = public;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. deadlines
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS deadlines (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id            UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  kind                  TEXT NOT NULL CHECK (kind IN (
                          'chapter_due',
                          'milestone_due',
                          'thesis_completion',
                          'proposal_due',
                          'defense_due',
                          'custom'
                        )),
  source_type           TEXT,
  source_id             UUID,
  target_at             TIMESTAMPTZ NOT NULL,
  owner_id              UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title                 TEXT NOT NULL,
  satisfied_at          TIMESTAMPTZ,
  satisfied_by          UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- One deadline per source row, so re-triggers UPSERT cleanly
  UNIQUE (source_type, source_id)
);

CREATE INDEX IF NOT EXISTS idx_deadlines_open_target
  ON deadlines (target_at)
  WHERE satisfied_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_deadlines_project
  ON deadlines (project_id);
CREATE INDEX IF NOT EXISTS idx_deadlines_owner
  ON deadlines (owner_id, satisfied_at);

ALTER TABLE deadlines ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'deadlines' AND policyname = 'deadlines_select'
  ) THEN
    CREATE POLICY "deadlines_select" ON deadlines
      FOR SELECT TO authenticated USING (
        owner_id = auth.uid()
        OR project_id IN (
          SELECT id FROM projects WHERE owner_id = auth.uid()
          UNION
          SELECT project_id FROM project_members WHERE user_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1 FROM supervisor_assignments sa
          WHERE sa.supervisor_id = auth.uid()
            AND sa.student_id    = deadlines.owner_id
            AND sa.status        = 'active'
        )
      );
  END IF;
END $$;

-- updated_at trigger
DROP TRIGGER IF EXISTS deadlines_updated_at ON deadlines;
CREATE TRIGGER deadlines_updated_at
  BEFORE UPDATE ON deadlines
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. deadline_reminders — idempotency ledger
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS deadline_reminders (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deadline_id    UUID NOT NULL REFERENCES deadlines(id) ON DELETE CASCADE,
  offset_label   TEXT NOT NULL,
  recipient_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  sent_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (deadline_id, offset_label, recipient_id)
);

CREATE INDEX IF NOT EXISTS idx_deadline_reminders_deadline
  ON deadline_reminders (deadline_id);

ALTER TABLE deadline_reminders ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'deadline_reminders' AND policyname = 'reminders_read_own'
  ) THEN
    CREATE POLICY "reminders_read_own" ON deadline_reminders
      FOR SELECT TO authenticated USING (recipient_id = auth.uid());
  END IF;
END $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. SOURCE TRIGGERS — chapters, milestones, thesis completion
--
-- Each one upserts a deadline row whenever the source's target date is set
-- or changed, and marks satisfied when the source advances to a terminal
-- state.
-- ─────────────────────────────────────────────────────────────────────────────

-- Chapter deadlines
CREATE OR REPLACE FUNCTION sync_chapter_deadline()
RETURNS TRIGGER AS $$
DECLARE
  v_owner UUID;
BEGIN
  -- Resolve owner from the project
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
      SET target_at = EXCLUDED.target_at,
          title     = EXCLUDED.title,
          -- Reopen if the target was moved and the chapter is back in play
          satisfied_at = CASE
            WHEN NEW.status IN ('approved','locked') THEN deadlines.satisfied_at
            ELSE NULL
          END;
  END IF;

  -- Satisfy when the chapter reaches a terminal state
  IF NEW.status IN ('approved','locked') THEN
    UPDATE deadlines
       SET satisfied_at = COALESCE(satisfied_at, now()),
           satisfied_by = NEW.approved_by
     WHERE source_type = 'thesis_chapter'
       AND source_id   = NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS thesis_chapters_sync_deadline ON thesis_chapters;
CREATE TRIGGER thesis_chapters_sync_deadline
  AFTER INSERT OR UPDATE OF target_date, status, title ON thesis_chapters
  FOR EACH ROW EXECUTE FUNCTION sync_chapter_deadline();

-- Milestone deadlines
CREATE OR REPLACE FUNCTION sync_milestone_deadline()
RETURNS TRIGGER AS $$
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
      SET target_at = EXCLUDED.target_at,
          title     = EXCLUDED.title,
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
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS student_milestones_sync_deadline ON student_milestones;
CREATE TRIGGER student_milestones_sync_deadline
  AFTER INSERT OR UPDATE OF due_date, status, title, project_id ON student_milestones
  FOR EACH ROW EXECUTE FUNCTION sync_milestone_deadline();

-- Thesis completion deadline
CREATE OR REPLACE FUNCTION sync_thesis_completion_deadline()
RETURNS TRIGGER AS $$
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
      SET target_at = EXCLUDED.target_at,
          title     = EXCLUDED.title,
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
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS thesis_metadata_sync_completion_deadline ON thesis_metadata;
CREATE TRIGGER thesis_metadata_sync_completion_deadline
  AFTER INSERT OR UPDATE OF expected_completion, lifecycle_state, thesis_title ON thesis_metadata
  FOR EACH ROW EXECUTE FUNCTION sync_thesis_completion_deadline();


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. BACKFILL existing rows
-- ─────────────────────────────────────────────────────────────────────────────

-- Chapters with target_date
INSERT INTO deadlines (project_id, kind, source_type, source_id, target_at, owner_id, title, satisfied_at)
SELECT
  tc.project_id,
  'chapter_due',
  'thesis_chapter',
  tc.id,
  tc.target_date::timestamptz,
  p.owner_id,
  'Chapter: ' || tc.title,
  CASE WHEN tc.status IN ('approved','locked') THEN COALESCE(tc.approved_at, now()) END
FROM thesis_chapters tc
JOIN projects p ON p.id = tc.project_id
WHERE tc.target_date IS NOT NULL
ON CONFLICT (source_type, source_id) DO NOTHING;

-- Milestones with due_date
INSERT INTO deadlines (project_id, kind, source_type, source_id, target_at, owner_id, title, satisfied_at)
SELECT
  COALESCE(sm.project_id, (SELECT id FROM projects WHERE owner_id = sm.student_id ORDER BY created_at LIMIT 1)),
  'milestone_due',
  'student_milestone',
  sm.id,
  sm.due_date::timestamptz,
  sm.student_id,
  'Milestone: ' || sm.title,
  CASE WHEN sm.status = 'approved' THEN COALESCE(sm.approved_at, now()) END
FROM student_milestones sm
WHERE sm.due_date IS NOT NULL
  AND COALESCE(sm.project_id, (SELECT id FROM projects WHERE owner_id = sm.student_id ORDER BY created_at LIMIT 1)) IS NOT NULL
ON CONFLICT (source_type, source_id) DO NOTHING;

-- Theses with expected_completion
INSERT INTO deadlines (project_id, kind, source_type, source_id, target_at, owner_id, title, satisfied_at)
SELECT
  tm.project_id,
  'thesis_completion',
  'thesis_metadata',
  tm.id,
  tm.expected_completion::timestamptz,
  p.owner_id,
  COALESCE(tm.thesis_title, 'Thesis completion'),
  CASE WHEN tm.lifecycle_state IN ('approved','archived') THEN now() END
FROM thesis_metadata tm
JOIN projects p ON p.id = tm.project_id
WHERE tm.expected_completion IS NOT NULL
ON CONFLICT (source_type, source_id) DO NOTHING;


-- Audit registry already contains 'thesis_deadline' and the reminder/escalated
-- action names (foundation migration 20260524000005). Nothing to add here.
