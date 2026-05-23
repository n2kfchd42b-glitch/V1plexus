-- ─────────────────────────────────────────────────────────────────────────────
-- Thesis Foundation
--
-- 1. Adds project_type to projects (defaults to 'research' — no existing rows break)
-- 2. Creates thesis_metadata — the institutional anchor (degree, program, department)
-- 3. Creates thesis_chapters — chapter workflow per thesis project
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. project_type column
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS project_type text NOT NULL DEFAULT 'research'
  CHECK (project_type IN ('research', 'thesis'));

-- 2. thesis_metadata
CREATE TABLE IF NOT EXISTS thesis_metadata (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id          uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  degree_type         text NOT NULL
    CHECK (degree_type IN ('msc', 'mphil', 'phd', 'drph', 'md', 'bachelor', 'other')),
  program_name        text NOT NULL,
  department          text,
  institution_id      uuid REFERENCES institutions(id) ON DELETE SET NULL,
  enrollment_date     date,
  expected_completion date,
  thesis_title        text,
  defense_status      text NOT NULL DEFAULT 'not_scheduled'
    CHECK (defense_status IN (
      'not_scheduled', 'proposal_scheduled', 'proposal_completed',
      'final_scheduled', 'final_completed',
      'passed', 'passed_with_corrections', 'revise_resubmit', 'failed'
    )),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id)
);

-- 3. thesis_chapters
CREATE TABLE IF NOT EXISTS thesis_chapters (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  document_id     uuid REFERENCES documents(id) ON DELETE SET NULL,
  chapter_number  integer NOT NULL,
  title           text NOT NULL,
  status          text NOT NULL DEFAULT 'not_started'
    CHECK (status IN (
      'not_started', 'drafting', 'submitted_for_review',
      'revision_requested', 'approved', 'locked'
    )),
  target_date     date,
  submitted_at    timestamptz,
  approved_at     timestamptz,
  approved_by     uuid REFERENCES profiles(id) ON DELETE SET NULL,
  sort_order      integer,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE thesis_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE thesis_chapters  ENABLE ROW LEVEL SECURITY;

-- Helper: user is owner or member of the project
-- (used inline — no function needed, keeps migration self-contained)

-- thesis_metadata policies
CREATE POLICY "thesis_metadata_select" ON thesis_metadata FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = thesis_metadata.project_id
        AND p.deleted_at IS NULL
        AND (
          p.owner_id = auth.uid()
          OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid())
        )
    )
  );

CREATE POLICY "thesis_metadata_insert" ON thesis_metadata FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = thesis_metadata.project_id
        AND p.owner_id = auth.uid()
    )
  );

CREATE POLICY "thesis_metadata_update" ON thesis_metadata FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = thesis_metadata.project_id
        AND (
          p.owner_id = auth.uid()
          OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid())
        )
    )
  );

-- thesis_chapters policies
CREATE POLICY "thesis_chapters_select" ON thesis_chapters FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = thesis_chapters.project_id
        AND p.deleted_at IS NULL
        AND (
          p.owner_id = auth.uid()
          OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid())
        )
    )
  );

CREATE POLICY "thesis_chapters_insert" ON thesis_chapters FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = thesis_chapters.project_id
        AND (
          p.owner_id = auth.uid()
          OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid())
        )
    )
  );

CREATE POLICY "thesis_chapters_update" ON thesis_chapters FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = thesis_chapters.project_id
        AND (
          p.owner_id = auth.uid()
          OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid())
        )
    )
  );

CREATE POLICY "thesis_chapters_delete" ON thesis_chapters FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = thesis_chapters.project_id
        AND p.owner_id = auth.uid()
    )
  );

-- updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'thesis_metadata_updated_at') THEN
    CREATE TRIGGER thesis_metadata_updated_at
      BEFORE UPDATE ON thesis_metadata
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'thesis_chapters_updated_at') THEN
    CREATE TRIGGER thesis_chapters_updated_at
      BEFORE UPDATE ON thesis_chapters
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;
