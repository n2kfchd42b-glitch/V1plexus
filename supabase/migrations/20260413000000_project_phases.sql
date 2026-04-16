-- Project Gantt phases table
-- Stores per-phase date ranges and completion for the interactive Gantt chart.
-- One row per (project, phase_key). Upserted by the phases API on every edit.

CREATE TABLE IF NOT EXISTS project_phases (
  id             UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id     UUID         NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  phase_key      TEXT         NOT NULL CHECK (phase_key IN (
                                'concept', 'protocol', 'ethics',
                                'data_collection', 'analysis', 'writing', 'publication'
                              )),
  start_date     DATE,
  end_date       DATE,
  completed_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ  DEFAULT NOW(),
  updated_at     TIMESTAMPTZ  DEFAULT NOW(),
  UNIQUE (project_id, phase_key)
);

ALTER TABLE project_phases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "phases_owner_all" ON project_phases;
DROP POLICY IF EXISTS "phases_member_select" ON project_phases;
DROP POLICY IF EXISTS "phases_member_write" ON project_phases;
DROP POLICY IF EXISTS "phases_member_update" ON project_phases;

-- Project owner can do everything
CREATE POLICY "phases_owner_all" ON project_phases
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_phases.project_id
        AND projects.owner_id = auth.uid()
    )
  );

-- Project members can read
CREATE POLICY "phases_member_select" ON project_phases
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM project_members
      WHERE project_members.project_id = project_phases.project_id
        AND project_members.user_id = auth.uid()
    )
  );

-- Project members can insert / update
CREATE POLICY "phases_member_write" ON project_phases
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM project_members
      WHERE project_members.project_id = project_phases.project_id
        AND project_members.user_id = auth.uid()
    )
  );

CREATE POLICY "phases_member_update" ON project_phases
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM project_members
      WHERE project_members.project_id = project_phases.project_id
        AND project_members.user_id = auth.uid()
    )
  );
