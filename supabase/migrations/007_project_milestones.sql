-- ════════════════════════════════════════
-- PLEXUS Phase 7: Project Milestones
-- ════════════════════════════════════════

CREATE TABLE project_milestones (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  description     TEXT,
  due_date        DATE,
  completed_at    TIMESTAMPTZ,
  status          TEXT DEFAULT 'pending' CHECK (status IN (
                    'pending', 'in_progress', 'completed', 'overdue', 'cancelled'
                  )),
  sort_order      INTEGER DEFAULT 0,
  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_milestones_project ON project_milestones(project_id);
CREATE INDEX idx_milestones_due_date ON project_milestones(due_date) WHERE due_date IS NOT NULL;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON project_milestones
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE project_milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Milestones visible to project members" ON project_milestones
  FOR SELECT TO authenticated USING (
    project_id IN (
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
      UNION SELECT id FROM projects WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Project members can create milestones" ON project_milestones
  FOR INSERT TO authenticated WITH CHECK (
    created_by = auth.uid() AND
    project_id IN (
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
      UNION SELECT id FROM projects WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Milestone creators and project owners can update" ON project_milestones
  FOR UPDATE TO authenticated USING (
    created_by = auth.uid() OR
    project_id IN (SELECT id FROM projects WHERE owner_id = auth.uid())
  );

CREATE POLICY "Project owners can delete milestones" ON project_milestones
  FOR DELETE TO authenticated USING (
    project_id IN (SELECT id FROM projects WHERE owner_id = auth.uid())
  );
