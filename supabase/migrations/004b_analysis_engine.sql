-- Phase 4A: Datasets infrastructure (minimal, required for Phase 4B)
CREATE TABLE IF NOT EXISTS datasets (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT,
  file_path       TEXT,                    -- Supabase Storage path
  file_name       TEXT,
  file_size       BIGINT,
  row_count       INTEGER,
  columns         JSONB NOT NULL DEFAULT '[]', -- Array of {name, type: numeric|categorical|date|text}
  sample_data     JSONB,                   -- First 100 rows for preview
  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS dataset_versions (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  dataset_id      UUID NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
  version_number  INTEGER NOT NULL DEFAULT 1,
  file_path       TEXT,
  row_count       INTEGER,
  columns         JSONB NOT NULL DEFAULT '[]',
  change_summary  TEXT,
  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_datasets_project ON datasets(project_id);
CREATE INDEX IF NOT EXISTS idx_dataset_versions_dataset ON dataset_versions(dataset_id);

ALTER TABLE datasets ENABLE ROW LEVEL SECURITY;
ALTER TABLE dataset_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Datasets visible to project members" ON datasets
  FOR SELECT TO authenticated USING (
    project_id IN (
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
      UNION SELECT id FROM projects WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Project members can create datasets" ON datasets
  FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());

CREATE POLICY "Project members can update datasets" ON datasets
  FOR UPDATE TO authenticated USING (
    project_id IN (
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
      UNION SELECT id FROM projects WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Dataset versions visible to project members" ON dataset_versions
  FOR SELECT TO authenticated USING (
    dataset_id IN (
      SELECT d.id FROM datasets d
      WHERE d.project_id IN (
        SELECT project_id FROM project_members WHERE user_id = auth.uid()
        UNION SELECT id FROM projects WHERE owner_id = auth.uid()
      )
    )
  );

CREATE POLICY "Project members can create dataset versions" ON dataset_versions
  FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());

CREATE TRIGGER set_datasets_updated_at BEFORE UPDATE ON datasets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Phase 4B: Analysis Engine
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
