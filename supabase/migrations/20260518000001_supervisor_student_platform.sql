-- ============================================================
-- Supervisor-Student Research Platform
-- 1. Extend supervisor_assignments with role
-- 2. milestone_templates  — department/supervisor-defined stages
-- 3. student_milestones   — per-student milestone instances
-- 4. milestone_submissions — immutable submission/feedback ledger
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- 1. EXTEND supervisor_assignments WITH ROLE
-- ────────────────────────────────────────────────────────────

ALTER TABLE supervisor_assignments
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'primary'
    CHECK (role IN ('primary', 'co_supervisor'));

-- Drop old unique constraint (didn't account for role)
ALTER TABLE supervisor_assignments
  DROP CONSTRAINT IF EXISTS supervisor_assignments_workspace_id_supervisor_id_student_id_key;

-- New unique: one supervisor can only hold one role per student
ALTER TABLE supervisor_assignments
  ADD CONSTRAINT supervisor_assignments_unique_role
    UNIQUE (workspace_id, supervisor_id, student_id, role);

-- Only one primary supervisor per student per workspace
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_primary_supervisor
  ON supervisor_assignments (workspace_id, student_id)
  WHERE role = 'primary' AND status = 'active';


-- ────────────────────────────────────────────────────────────
-- 2. MILESTONE TEMPLATES
-- Supervisor or department admin defines the research stages
-- that every student in a programme must pass through.
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS milestone_templates (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id      UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  department_id     UUID REFERENCES departments(id) ON DELETE SET NULL,
  created_by        UUID NOT NULL REFERENCES profiles(id),
  title             TEXT NOT NULL,
  description       TEXT,
  order_index       INTEGER NOT NULL DEFAULT 0,
  requires_document BOOLEAN NOT NULL DEFAULT false,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_milestone_templates_workspace
  ON milestone_templates (workspace_id);

CREATE INDEX IF NOT EXISTS idx_milestone_templates_department
  ON milestone_templates (department_id);


-- ────────────────────────────────────────────────────────────
-- 3. STUDENT MILESTONES
-- Actual milestone instances assigned to a specific student.
-- Created from a template or manually by the supervisor.
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS student_milestones (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  student_id    UUID NOT NULL REFERENCES profiles(id),
  supervisor_id UUID NOT NULL REFERENCES profiles(id), -- primary supervisor
  template_id   UUID REFERENCES milestone_templates(id) ON DELETE SET NULL,
  title         TEXT NOT NULL,
  description   TEXT,
  order_index   INTEGER NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN (
                    'pending',
                    'submitted',
                    'under_review',
                    'revision_requested',
                    'approved'
                  )),
  due_date      DATE,
  approved_by   UUID REFERENCES profiles(id),
  approved_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_student_milestones_student
  ON student_milestones (student_id, status);

CREATE INDEX IF NOT EXISTS idx_student_milestones_supervisor
  ON student_milestones (supervisor_id, status);


-- ────────────────────────────────────────────────────────────
-- 4. MILESTONE SUBMISSIONS
-- Immutable ledger. Each submission or resubmission creates
-- a new row — rows are never updated after insert except to
-- add supervisor feedback (reviewed_by, reviewed_at, decision,
-- feedback). Students cannot delete rows.
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS milestone_submissions (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  milestone_id  UUID NOT NULL REFERENCES student_milestones(id) ON DELETE CASCADE,
  student_id    UUID NOT NULL REFERENCES profiles(id),
  round         INTEGER NOT NULL DEFAULT 1,
  note          TEXT,
  document_id   UUID REFERENCES documents(id) ON DELETE SET NULL,
  submitted_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Supervisor response (filled after review — single UPDATE, then locked)
  reviewed_by   UUID REFERENCES profiles(id),
  reviewed_at   TIMESTAMPTZ,
  decision      TEXT CHECK (decision IN ('approved', 'revision_requested')),
  feedback      TEXT
);

CREATE INDEX IF NOT EXISTS idx_milestone_submissions_milestone
  ON milestone_submissions (milestone_id);

CREATE INDEX IF NOT EXISTS idx_milestone_submissions_student
  ON milestone_submissions (student_id, submitted_at DESC);


-- ────────────────────────────────────────────────────────────
-- UPDATED_AT TRIGGERS
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER milestone_templates_updated_at
  BEFORE UPDATE ON milestone_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER student_milestones_updated_at
  BEFORE UPDATE ON student_milestones
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ────────────────────────────────────────────────────────────

ALTER TABLE milestone_templates   ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_milestones    ENABLE ROW LEVEL SECURITY;
ALTER TABLE milestone_submissions  ENABLE ROW LEVEL SECURITY;


-- ── milestone_templates policies ─────────────────────────────

-- Workspace members can read templates
CREATE POLICY "Workspace members can view milestone templates"
  ON milestone_templates FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_memberships
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- Supervisors and admins can create templates
CREATE POLICY "Supervisors can create milestone templates"
  ON milestone_templates FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
    AND workspace_id IN (
      SELECT workspace_id FROM workspace_memberships
      WHERE user_id = auth.uid()
        AND status = 'active'
        AND role IN ('owner', 'admin', 'supervisor', 'department_head')
    )
  );

-- Only creator can update their templates
CREATE POLICY "Creators can update milestone templates"
  ON milestone_templates FOR UPDATE
  USING (created_by = auth.uid());

-- Only creator can delete their templates
CREATE POLICY "Creators can delete milestone templates"
  ON milestone_templates FOR DELETE
  USING (created_by = auth.uid());


-- ── student_milestones policies ───────────────────────────────

-- Students see their own milestones
CREATE POLICY "Students can view their own milestones"
  ON student_milestones FOR SELECT
  USING (student_id = auth.uid());

-- Supervisors see milestones for their assigned students
CREATE POLICY "Supervisors can view their students milestones"
  ON student_milestones FOR SELECT
  USING (
    supervisor_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM supervisor_assignments sa
      WHERE sa.supervisor_id = auth.uid()
        AND sa.student_id = student_milestones.student_id
        AND sa.status = 'active'
    )
  );

-- Supervisors create milestones for their students
CREATE POLICY "Supervisors can create student milestones"
  ON student_milestones FOR INSERT
  WITH CHECK (
    supervisor_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM supervisor_assignments sa
      WHERE sa.supervisor_id = auth.uid()
        AND sa.student_id = student_milestones.student_id
        AND sa.status = 'active'
    )
  );

-- Only the primary supervisor can update milestones (approve/block)
CREATE POLICY "Primary supervisors can update student milestones"
  ON student_milestones FOR UPDATE
  USING (supervisor_id = auth.uid());


-- ── milestone_submissions policies ───────────────────────────

-- Students see their own submissions
CREATE POLICY "Students can view their own submissions"
  ON milestone_submissions FOR SELECT
  USING (student_id = auth.uid());

-- Supervisors see submissions for their assigned students
CREATE POLICY "Supervisors can view their students submissions"
  ON milestone_submissions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM supervisor_assignments sa
      WHERE sa.supervisor_id = auth.uid()
        AND sa.student_id = milestone_submissions.student_id
        AND sa.status = 'active'
    )
  );

-- Students can submit (INSERT) their own submissions
CREATE POLICY "Students can submit milestones"
  ON milestone_submissions FOR INSERT
  WITH CHECK (student_id = auth.uid());

-- Supervisors can add feedback (UPDATE reviewed_by/at/decision/feedback only)
-- Students cannot update — ledger is append-only for them
CREATE POLICY "Supervisors can review submissions"
  ON milestone_submissions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM supervisor_assignments sa
      WHERE sa.supervisor_id = auth.uid()
        AND sa.student_id = milestone_submissions.student_id
        AND sa.status = 'active'
    )
  );

-- Nobody can delete submissions — immutable ledger
-- (No DELETE policy = denied for all authenticated users)
