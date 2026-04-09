-- ─────────────────────────────────────────────────────────────────────────────
-- PHASE C: Analytics Intelligence + Data Portrait + Visualisation
-- ─────────────────────────────────────────────────────────────────────────────

-- ── LAYER 1: Statistical narrative per analysis run ──────────────────────────

CREATE TABLE analysis_narratives (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  dataset_id          UUID REFERENCES datasets(id) ON DELETE CASCADE,
  analysis_run_id     UUID REFERENCES analysis_runs(id) ON DELETE CASCADE,
  analysis_type       TEXT NOT NULL,
  variables           JSONB NOT NULL DEFAULT '{}',

  deterministic_text  TEXT NOT NULL,
  ai_text             TEXT,
  ai_requested        BOOLEAN DEFAULT false,
  ai_generated_at     TIMESTAMPTZ,
  active_version      TEXT DEFAULT 'deterministic'
                      CHECK (active_version IN ('deterministic', 'ai')),
  components          JSONB DEFAULT '{}',

  created_by          UUID REFERENCES auth.users(id),
  created_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_analysis_narratives_project ON analysis_narratives(project_id, dataset_id);
CREATE INDEX idx_analysis_narratives_run ON analysis_narratives(analysis_run_id);


-- ── LAYER 1: Sensitivity panel results ───────────────────────────────────────

CREATE TABLE analysis_sensitivity_results (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  dataset_id          UUID NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
  analysis_type       TEXT NOT NULL,
  primary_variables   JSONB NOT NULL DEFAULT '{}',

  -- [{label, method_variant, estimate, ci_lower, ci_upper, p_value, metric_label, n, note}]
  comparisons         JSONB NOT NULL DEFAULT '[]',
  consistent          BOOLEAN,

  created_by          UUID REFERENCES auth.users(id),
  created_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_sensitivity_project ON analysis_sensitivity_results(project_id, dataset_id);


-- ── LAYER 2: Data Portrait ────────────────────────────────────────────────────

CREATE TABLE dataset_portraits (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_id                  UUID NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
  project_id                  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

  n_rows                      INTEGER,
  n_columns                   INTEGER,
  file_size_bytes             BIGINT,

  overall_missing_pct         NUMERIC,
  missing_pattern             TEXT CHECK (missing_pattern IN ('mcar', 'mar', 'mnar', 'unknown')),
  little_mcar_p_value         NUMERIC,
  missing_pattern_notes       TEXT,

  -- [{name, dtype, role_hint, n_missing, pct_missing, unique_count,
  --   mean, sd, min, max, p25, p50, p75, skewness, kurtosis,
  --   top_values, outlier_count, is_constant, is_id_like}]
  variable_profiles           JSONB NOT NULL DEFAULT '[]',

  missingness_matrix_b64      TEXT,

  -- [{variable, recommendation, reason}]
  imputation_recommendations  JSONB DEFAULT '[]',

  -- [{analysis_type, reason, confidence}]
  analysis_recommendations    JSONB DEFAULT '[]',

  status                      TEXT DEFAULT 'pending'
                              CHECK (status IN ('pending', 'running', 'complete', 'failed')),
  error_message               TEXT,

  created_at                  TIMESTAMPTZ DEFAULT now(),
  completed_at                TIMESTAMPTZ
);

CREATE INDEX idx_portraits_dataset ON dataset_portraits(dataset_id);
CREATE UNIQUE INDEX idx_portraits_dataset_unique ON dataset_portraits(dataset_id);


-- ── LAYER 3: Analysis Timeline ────────────────────────────────────────────────

CREATE TABLE analysis_timeline_entries (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id            UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  dataset_id            UUID NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,

  parent_id             UUID REFERENCES analysis_timeline_entries(id),
  branch_name           TEXT DEFAULT 'main',
  is_primary            BOOLEAN DEFAULT false,

  analysis_type         TEXT NOT NULL,
  variables             JSONB NOT NULL DEFAULT '{}',

  -- {estimate, ci_lower, ci_upper, p_value, metric_label}
  key_result            JSONB,
  label                 TEXT,

  assumption_status     TEXT CHECK (assumption_status IN ('green', 'amber', 'red')),
  assumption_check_id   UUID REFERENCES analysis_assumption_checks(id),
  causal_dag_id         UUID REFERENCES causal_dags(id),

  created_by            UUID REFERENCES auth.users(id),
  created_at            TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_timeline_project_dataset ON analysis_timeline_entries(project_id, dataset_id);
CREATE INDEX idx_timeline_parent ON analysis_timeline_entries(parent_id);


-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE analysis_narratives           ENABLE ROW LEVEL SECURITY;
ALTER TABLE analysis_sensitivity_results  ENABLE ROW LEVEL SECURITY;
ALTER TABLE dataset_portraits             ENABLE ROW LEVEL SECURITY;
ALTER TABLE analysis_timeline_entries     ENABLE ROW LEVEL SECURITY;

CREATE POLICY "phase_c_narratives_access" ON analysis_narratives
  FOR ALL USING (
    project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid())
  );

CREATE POLICY "phase_c_sensitivity_access" ON analysis_sensitivity_results
  FOR ALL USING (
    project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid())
  );

CREATE POLICY "phase_c_portraits_access" ON dataset_portraits
  FOR ALL USING (
    project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid())
  );

CREATE POLICY "phase_c_timeline_access" ON analysis_timeline_entries
  FOR ALL USING (
    project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid())
  );

-- Enable realtime for portrait status updates
ALTER PUBLICATION supabase_realtime ADD TABLE dataset_portraits;
