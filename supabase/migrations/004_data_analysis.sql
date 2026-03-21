-- ════════════════════════════════════════
-- PLEXUS Phase 4: Data Import & Analysis
-- ════════════════════════════════════════

-- ════════════════════════════════════════
-- DATASETS
-- ════════════════════════════════════════
CREATE TABLE datasets (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT,
  source          TEXT DEFAULT 'upload' CHECK (source IN (
                    'upload', 'kobo', 'redcap', 'csv', 'excel', 'spss'
                  )),
  file_path       TEXT NOT NULL,          -- Supabase Storage path
  file_name       TEXT NOT NULL,
  file_size       BIGINT,
  file_hash       TEXT,                   -- SHA-256 for integrity verification
  mime_type       TEXT,
  row_count       INTEGER,
  column_count    INTEGER,
  schema_info     JSONB,                  -- Column names, types, null counts, sample values
  uploaded_by     UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_datasets_project ON datasets(project_id);


-- ════════════════════════════════════════
-- ANALYSIS JOBS
-- ════════════════════════════════════════
CREATE TABLE analysis_jobs (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  dataset_id      UUID REFERENCES datasets(id),
  title           TEXT,
  engine          TEXT NOT NULL CHECK (engine IN ('r', 'python')),
  script_content  TEXT,                   -- The R or Python code
  status          TEXT DEFAULT 'pending' CHECK (status IN (
                    'pending', 'running', 'completed', 'failed', 'cancelled'
                  )),
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  duration_ms     INTEGER,
  error_log       TEXT,
  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_analysis_project ON analysis_jobs(project_id);


-- ════════════════════════════════════════
-- ANALYSIS OUTPUTS
-- ════════════════════════════════════════
CREATE TABLE analysis_outputs (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id          UUID NOT NULL REFERENCES analysis_jobs(id) ON DELETE CASCADE,
  output_type     TEXT NOT NULL CHECK (output_type IN (
                    'table', 'figure', 'log', 'summary', 'file'
                  )),
  title           TEXT,
  content         JSONB,                  -- For tables: { headers: [], rows: [] }
  file_path       TEXT,                   -- Supabase Storage path for figures/files
  file_name       TEXT,
  metadata        JSONB DEFAULT '{}',
  sort_order      INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT now()
);


-- RLS
ALTER TABLE datasets ENABLE ROW LEVEL SECURITY;
ALTER TABLE analysis_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE analysis_outputs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Datasets visible to project members" ON datasets
  FOR SELECT TO authenticated USING (
    project_id IN (
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
      UNION SELECT id FROM projects WHERE owner_id = auth.uid()
    )
  );
CREATE POLICY "Project members can upload datasets" ON datasets
  FOR INSERT TO authenticated WITH CHECK (uploaded_by = auth.uid());

CREATE POLICY "Project members can update datasets" ON datasets
  FOR UPDATE TO authenticated USING (
    project_id IN (
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
      UNION SELECT id FROM projects WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Analysis jobs visible to project members" ON analysis_jobs
  FOR SELECT TO authenticated USING (
    project_id IN (
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
      UNION SELECT id FROM projects WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Project members can create analysis jobs" ON analysis_jobs
  FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());

CREATE POLICY "Project members can update analysis jobs" ON analysis_jobs
  FOR UPDATE TO authenticated USING (
    project_id IN (
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
      UNION SELECT id FROM projects WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Analysis outputs visible via job membership" ON analysis_outputs
  FOR SELECT TO authenticated USING (
    job_id IN (
      SELECT id FROM analysis_jobs WHERE project_id IN (
        SELECT project_id FROM project_members WHERE user_id = auth.uid()
        UNION SELECT id FROM projects WHERE owner_id = auth.uid()
      )
    )
  );

CREATE POLICY "Authenticated can create analysis outputs" ON analysis_outputs
  FOR INSERT TO authenticated WITH CHECK (
    job_id IN (
      SELECT id FROM analysis_jobs WHERE created_by = auth.uid()
    )
  );

-- Updated_at triggers
CREATE TRIGGER set_updated_at BEFORE UPDATE ON datasets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON analysis_jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
