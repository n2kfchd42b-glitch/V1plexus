-- ════════════════════════════════════════════════════════════════
-- PHASE 4A: DATA INFRASTRUCTURE
-- Dataset versioning, cleaning, merging, and visual exploration
-- ════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════
-- DATASETS (base table)
-- ════════════════════════════════════════
CREATE TABLE datasets (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT,
  source          TEXT DEFAULT 'upload' CHECK (source IN (
                    'upload', 'kobo', 'redcap', 'merge', 'append', 'clean', 'branch'
                  )),
  parent_id       UUID REFERENCES datasets(id),     -- NULL for original uploads
  uploaded_by     UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_datasets_project ON datasets(project_id);
CREATE INDEX idx_datasets_parent ON datasets(parent_id) WHERE parent_id IS NOT NULL;


-- ════════════════════════════════════════
-- DATASET VERSIONS (immutable snapshots)
-- ════════════════════════════════════════
CREATE TABLE dataset_versions (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  dataset_id      UUID NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
  version_number  INTEGER NOT NULL,
  parent_version  UUID REFERENCES dataset_versions(id),
  commit_message  TEXT NOT NULL,
  file_path       TEXT NOT NULL,          -- Supabase Storage path
  file_hash       TEXT NOT NULL,          -- SHA-256 of file content
  file_size       BIGINT,
  row_count       INTEGER NOT NULL,
  column_count    INTEGER NOT NULL,
  schema_info     JSONB NOT NULL,         -- [{name, type, null_count, unique_count, min, max, mean, sample_values}]
  operations      JSONB DEFAULT '[]',     -- Array of operations applied
  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(dataset_id, version_number)
);

CREATE INDEX idx_versions_dataset ON dataset_versions(dataset_id);


-- ════════════════════════════════════════
-- DATASET BRANCHES
-- ════════════════════════════════════════
CREATE TABLE dataset_branches (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  dataset_id      UUID NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,           -- "main", "cleaned", "subset-northern-region"
  head_version    UUID NOT NULL REFERENCES dataset_versions(id),
  is_default      BOOLEAN DEFAULT false,
  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(dataset_id, name)
);

CREATE INDEX idx_branches_dataset ON dataset_branches(dataset_id);


-- ════════════════════════════════════════
-- SAVED EXPLORATIONS (chart configurations)
-- ════════════════════════════════════════
CREATE TABLE dataset_explorations (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  dataset_id      UUID NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
  version_id      UUID REFERENCES dataset_versions(id),
  title           TEXT NOT NULL,
  chart_type      TEXT NOT NULL,
  config          JSONB NOT NULL,
  thumbnail_path  TEXT,
  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_explorations_dataset ON dataset_explorations(dataset_id);


-- ════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ════════════════════════════════════════
ALTER TABLE datasets ENABLE ROW LEVEL SECURITY;
ALTER TABLE dataset_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE dataset_branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE dataset_explorations ENABLE ROW LEVEL SECURITY;

-- Datasets: visible to project members
CREATE POLICY "Datasets visible to project members" ON datasets
  FOR SELECT TO authenticated USING (
    project_id IN (
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
      UNION SELECT id FROM projects WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Project members can create datasets" ON datasets
  FOR INSERT TO authenticated WITH CHECK (
    uploaded_by = auth.uid() AND
    project_id IN (
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
      UNION SELECT id FROM projects WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Uploaders can update their datasets" ON datasets
  FOR UPDATE TO authenticated USING (uploaded_by = auth.uid());

CREATE POLICY "Uploaders can delete their datasets" ON datasets
  FOR DELETE TO authenticated USING (uploaded_by = auth.uid());

-- Dataset versions: follow dataset access
CREATE POLICY "Versions visible to dataset viewers" ON dataset_versions
  FOR SELECT TO authenticated USING (
    dataset_id IN (
      SELECT d.id FROM datasets d
      WHERE d.project_id IN (
        SELECT project_id FROM project_members WHERE user_id = auth.uid()
        UNION SELECT id FROM projects WHERE owner_id = auth.uid()
      )
    )
  );

CREATE POLICY "Project members can create versions" ON dataset_versions
  FOR INSERT TO authenticated WITH CHECK (
    created_by = auth.uid() AND
    dataset_id IN (
      SELECT d.id FROM datasets d
      WHERE d.project_id IN (
        SELECT project_id FROM project_members WHERE user_id = auth.uid()
        UNION SELECT id FROM projects WHERE owner_id = auth.uid()
      )
    )
  );

-- Dataset branches: follow dataset access
CREATE POLICY "Branches visible to dataset viewers" ON dataset_branches
  FOR SELECT TO authenticated USING (
    dataset_id IN (
      SELECT d.id FROM datasets d
      WHERE d.project_id IN (
        SELECT project_id FROM project_members WHERE user_id = auth.uid()
        UNION SELECT id FROM projects WHERE owner_id = auth.uid()
      )
    )
  );

CREATE POLICY "Project members can create branches" ON dataset_branches
  FOR INSERT TO authenticated WITH CHECK (
    created_by = auth.uid() AND
    dataset_id IN (
      SELECT d.id FROM datasets d
      WHERE d.project_id IN (
        SELECT project_id FROM project_members WHERE user_id = auth.uid()
        UNION SELECT id FROM projects WHERE owner_id = auth.uid()
      )
    )
  );

CREATE POLICY "Branch creators can update branches" ON dataset_branches
  FOR UPDATE TO authenticated USING (created_by = auth.uid());

-- Explorations: follow dataset access
CREATE POLICY "Explorations visible to dataset viewers" ON dataset_explorations
  FOR SELECT TO authenticated USING (
    dataset_id IN (
      SELECT d.id FROM datasets d
      WHERE d.project_id IN (
        SELECT project_id FROM project_members WHERE user_id = auth.uid()
        UNION SELECT id FROM projects WHERE owner_id = auth.uid()
      )
    )
  );

CREATE POLICY "Project members can create explorations" ON dataset_explorations
  FOR INSERT TO authenticated WITH CHECK (
    created_by = auth.uid() AND
    dataset_id IN (
      SELECT d.id FROM datasets d
      WHERE d.project_id IN (
        SELECT project_id FROM project_members WHERE user_id = auth.uid()
        UNION SELECT id FROM projects WHERE owner_id = auth.uid()
      )
    )
  );

CREATE POLICY "Exploration creators can update" ON dataset_explorations
  FOR UPDATE TO authenticated USING (created_by = auth.uid());

CREATE POLICY "Exploration creators can delete" ON dataset_explorations
  FOR DELETE TO authenticated USING (created_by = auth.uid());


-- ════════════════════════════════════════
-- TRIGGERS
-- ════════════════════════════════════════
CREATE TRIGGER set_updated_at BEFORE UPDATE ON datasets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON dataset_branches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON dataset_explorations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ════════════════════════════════════════
-- STORAGE BUCKETS
-- ════════════════════════════════════════
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'datasets', 'datasets', false, 104857600,
  ARRAY[
    'text/csv', 'application/json',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/tab-separated-values',
    'application/octet-stream'
  ]
) ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('chart-thumbnails', 'chart-thumbnails', false, 2097152)
ON CONFLICT (id) DO NOTHING;
