-- Link milestones to research phases and projects
-- This is the join that makes milestones drive phase progression

ALTER TABLE student_milestones
  ADD COLUMN IF NOT EXISTS phase        text,
  ADD COLUMN IF NOT EXISTS project_id   uuid REFERENCES projects(id) ON DELETE SET NULL;

-- Index for fast phase-completion lookups
CREATE INDEX IF NOT EXISTS idx_student_milestones_phase
  ON student_milestones(student_id, project_id, phase)
  WHERE phase IS NOT NULL;

-- Validate phase values (same set as PhaseBar)
ALTER TABLE student_milestones
  ADD CONSTRAINT chk_milestone_phase CHECK (
    phase IS NULL OR phase IN (
      'concept', 'protocol', 'ethics', 'data',
      'analysis', 'writing', 'publication'
    )
  );
