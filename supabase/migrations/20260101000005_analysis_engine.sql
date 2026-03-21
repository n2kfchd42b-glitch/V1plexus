-- Phase 4B: Analysis Engine
-- datasets and dataset_versions are already created by 20260101000004_data_infrastructure.sql

CREATE TABLE analysis_runs (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  dataset_id      UUID REFERENCES datasets(id),
  version_id      UUID REFERENCES dataset_versions(id),
  analysis_type   TEXT NOT NULL,
  title           TEXT,
  config          JSONB NOT NULL DEFAULT '{}',
  results         JSONB,
  chart_config    JSONB,
  status          TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  error_message   TEXT,
  interpretation  TEXT,
  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_analysis_project ON analysis_runs(project_id);
CREATE INDEX idx_analysis_dataset ON analysis_runs(dataset_id);
CREATE INDEX idx_analysis_type ON analysis_runs(analysis_type);

ALTER TABLE analysis_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Analysis visible to project members" ON analysis_runs
  FOR SELECT TO authenticated USING (
    project_id IN (
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
      UNION SELECT id FROM projects WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Project members can create analysis" ON analysis_runs
  FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());

CREATE POLICY "Project members can update analysis" ON analysis_runs
  FOR UPDATE TO authenticated USING (
    project_id IN (
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
      UNION SELECT id FROM projects WHERE owner_id = auth.uid()
    )
  );

CREATE TRIGGER set_analysis_updated_at BEFORE UPDATE ON analysis_runs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
