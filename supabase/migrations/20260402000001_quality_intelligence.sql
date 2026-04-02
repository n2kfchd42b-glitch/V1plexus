-- Phase 3: Automated Quality Intelligence
-- Adds dataset quality scoring and wave consistency analysis

-- TABLE 1: dataset_quality_reports
CREATE TABLE public.dataset_quality_reports (
  id UUID DEFAULT gen_random_uuid()
    PRIMARY KEY,
  
  dataset_id UUID NOT NULL
    REFERENCES datasets(id)
    ON DELETE CASCADE,
  
  version_id UUID NOT NULL
    REFERENCES dataset_versions(id)
    ON DELETE CASCADE,
  
  computed_at TIMESTAMPTZ
    DEFAULT now() NOT NULL,
  
  computed_by UUID
    REFERENCES profiles(id)
    ON DELETE SET NULL,
  
  -- Overall score 0-100
  overall_score INTEGER NOT NULL
    CHECK (overall_score BETWEEN 0 AND 100),
  
  -- Score breakdown JSONB
  -- Each dimension: { score, weight, findings[] }
  dimensions JSONB NOT NULL 
    DEFAULT '{}',
  
  -- All flags requiring attention
  -- [{ severity, variable, message, category, auto_resolved }]
  flags JSONB NOT NULL DEFAULT '[]',
  
  -- Enumerator metrics
  -- Only populated if enumerator column detected
  -- { enumerator_id: { metrics } }
  enumerator_metrics JSONB 
    DEFAULT NULL,
  
  -- Readiness assessment
  readiness_status TEXT NOT NULL
    CHECK (readiness_status IN (
      'ready',
      'caution', 
      'not_ready'
    )),
  
  -- Human readable readiness summary
  readiness_summary TEXT NOT NULL,
  
  -- Version of the scoring algorithm
  algorithm_version TEXT NOT NULL
    DEFAULT 'v1.0',
  
  UNIQUE(version_id)
);

CREATE INDEX idx_quality_dataset
  ON dataset_quality_reports(
    dataset_id, computed_at DESC
  );

CREATE INDEX idx_quality_version
  ON dataset_quality_reports(version_id);

ALTER TABLE dataset_quality_reports
  ENABLE ROW LEVEL SECURITY;

CREATE POLICY
  "Quality reports visible to project members"
  ON dataset_quality_reports
  FOR SELECT TO authenticated
  USING (
    dataset_id IN (
      SELECT d.id FROM datasets d
      WHERE d.project_id IN (
        SELECT project_id 
        FROM project_members
        WHERE user_id = auth.uid()
        UNION
        SELECT id FROM projects
        WHERE owner_id = auth.uid()
      )
    )
  );

CREATE POLICY
  "System can insert quality reports"
  ON dataset_quality_reports
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- TABLE 2: wave_consistency_reports
CREATE TABLE public.wave_consistency_reports (
  id UUID DEFAULT gen_random_uuid()
    PRIMARY KEY,
  
  project_id UUID NOT NULL
    REFERENCES projects(id)
    ON DELETE CASCADE,
  
  -- The two dataset versions compared
  wave_a_version_id UUID NOT NULL
    REFERENCES dataset_versions(id)
    ON DELETE CASCADE,
  
  wave_b_version_id UUID NOT NULL
    REFERENCES dataset_versions(id)
    ON DELETE CASCADE,
  
  -- Column used to link participants across waves
  participant_id_column TEXT NOT NULL,
  
  computed_at TIMESTAMPTZ
    DEFAULT now() NOT NULL,
  
  -- Summary counts
  participants_wave_a INTEGER NOT NULL,
  participants_wave_b INTEGER NOT NULL,
  matched_participants INTEGER NOT NULL,
  only_in_wave_a INTEGER NOT NULL,
  only_in_wave_b INTEGER NOT NULL,
  
  -- Detailed inconsistencies
  -- [{ variable, type, count, examples, severity }]
  inconsistencies JSONB NOT NULL
    DEFAULT '[]',
  
  -- Distribution shift results per variable
  -- { variable: { test, statistic, p_value, interpretation } }
  distribution_shifts JSONB NOT NULL
    DEFAULT '{}',
  
  -- Overall consistency score 0-100
  consistency_score INTEGER NOT NULL,
  
  computed_by UUID
    REFERENCES profiles(id)
    ON DELETE SET NULL
);

CREATE INDEX idx_wave_project
  ON wave_consistency_reports(
    project_id, computed_at DESC
  );

ALTER TABLE wave_consistency_reports
  ENABLE ROW LEVEL SECURITY;

CREATE POLICY
  "Wave reports visible to project members"
  ON wave_consistency_reports
  FOR SELECT TO authenticated
  USING (
    project_id IN (
      SELECT project_id
      FROM project_members
      WHERE user_id = auth.uid()
      UNION
      SELECT id FROM projects
      WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY
  "System can insert wave reports"
  ON wave_consistency_reports
  FOR INSERT TO authenticated
  WITH CHECK (true);
