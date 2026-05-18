-- ================================================================
-- Supervision Annotations & Records
--
-- supervision_annotations: contextual, anchor-based feedback
--   left by supervisors on specific dataset columns, analysis
--   output blocks, or document selections.
--
-- supervision_records: formal session summaries that close a
--   review session and generate the supervision audit trail.
-- ================================================================

CREATE TABLE IF NOT EXISTS supervision_annotations (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  supervisor_id UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id    UUID        NOT NULL REFERENCES projects(id)   ON DELETE CASCADE,
  artifact_type TEXT        NOT NULL CHECK (artifact_type IN ('dataset', 'analysis', 'document')),
  artifact_id   UUID        NOT NULL,
  -- anchor: column name for datasets; table/chart id for analysis; selection text for documents
  anchor        TEXT        NOT NULL,
  anchor_label  TEXT,
  content       TEXT        NOT NULL,
  is_resolved   BOOLEAN     NOT NULL DEFAULT FALSE,
  resolved_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS supervision_records (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  supervisor_id UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id    UUID        NOT NULL REFERENCES projects(id)   ON DELETE CASCADE,
  title         TEXT        NOT NULL DEFAULT 'Supervision Session',
  summary       TEXT        NOT NULL,
  action_items  TEXT[]      NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_supervision_annotations_artifact
  ON supervision_annotations (artifact_id, artifact_type);

CREATE INDEX IF NOT EXISTS idx_supervision_annotations_project
  ON supervision_annotations (project_id);

CREATE INDEX IF NOT EXISTS idx_supervision_records_project
  ON supervision_records (project_id, created_at DESC);

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE supervision_annotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE supervision_records     ENABLE ROW LEVEL SECURITY;

-- Supervisor can read/write their own annotations
CREATE POLICY "Supervisors manage their annotations"
  ON supervision_annotations
  USING (supervisor_id = auth.uid())
  WITH CHECK (supervisor_id = auth.uid());

-- Students can read annotations on their own work (not create)
CREATE POLICY "Students read annotations on their work"
  ON supervision_annotations FOR SELECT
  USING (student_id = auth.uid());

-- Supervisor can read/write their own records
CREATE POLICY "Supervisors manage their records"
  ON supervision_records
  USING (supervisor_id = auth.uid())
  WITH CHECK (supervisor_id = auth.uid());

-- Students can read supervision records about them
CREATE POLICY "Students read their supervision records"
  ON supervision_records FOR SELECT
  USING (student_id = auth.uid());
