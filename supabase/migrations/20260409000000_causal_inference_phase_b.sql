-- =============================================================================
-- PLEXUS Causal Inference Engine — Phase B
-- Estimation results, E-values, and causal narratives
-- =============================================================================

-- Stores results for all three estimation methods per DAG.
-- Unique per (dag_id, method) — upserted on re-run.
CREATE TABLE causal_estimation_results (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dag_id              UUID NOT NULL REFERENCES causal_dags(id) ON DELETE CASCADE,
  dataset_id          UUID NOT NULL REFERENCES datasets(id),
  project_id          UUID NOT NULL REFERENCES projects(id),

  method              TEXT NOT NULL
                      CHECK (method IN ('psm', 'ipw', 'doubly_robust')),

  -- Core causal estimates
  ate                 NUMERIC,
  att                 NUMERIC,
  ate_ci_lower        NUMERIC,
  ate_ci_upper        NUMERIC,
  att_ci_lower        NUMERIC,
  att_ci_upper        NUMERIC,
  std_error           NUMERIC,
  p_value             NUMERIC,

  -- Method-specific diagnostics
  -- PSM:          {n_matched, balance_stats, caliper_used, matching_ratio}
  -- IPW:          {weight_summary, effective_sample_size, trimming_applied}
  -- Doubly Robust:{outcome_model, propensity_model, augmentation_term}
  diagnostics         JSONB DEFAULT '{}',

  -- [{variable, smd_before, smd_after, variance_ratio}]
  balance_table       JSONB DEFAULT '[]',

  -- 100-sample bootstrap distribution for curve rendering
  bootstrap_estimates JSONB DEFAULT '[]',

  status              TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'running', 'complete', 'failed')),
  error_message       TEXT,

  created_by          UUID REFERENCES auth.users(id),
  created_at          TIMESTAMPTZ DEFAULT now(),
  completed_at        TIMESTAMPTZ,

  -- Enforce one row per method per DAG
  UNIQUE (dag_id, method)
);

CREATE INDEX idx_estimation_dag_id    ON causal_estimation_results(dag_id);
CREATE INDEX idx_estimation_project_id ON causal_estimation_results(project_id);


-- Stores E-value results and sensitivity curve data points
CREATE TABLE causal_evalues (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dag_id              UUID NOT NULL REFERENCES causal_dags(id) ON DELETE CASCADE,
  estimation_id       UUID REFERENCES causal_estimation_results(id),
  project_id          UUID NOT NULL REFERENCES projects(id),

  evalue_estimate     NUMERIC NOT NULL,
  evalue_ci_bound     NUMERIC NOT NULL,
  rr_input            NUMERIC NOT NULL,

  -- [{rr_confounder_exposure, rr_confounder_outcome_needed, nullifies_effect}]
  sensitivity_curve   JSONB DEFAULT '[]',

  interpretation      TEXT,
  created_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_evalues_dag_id ON causal_evalues(dag_id);


-- Stores generated causal narratives
CREATE TABLE causal_narratives (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dag_id              UUID NOT NULL REFERENCES causal_dags(id) ON DELETE CASCADE,
  project_id          UUID NOT NULL REFERENCES projects(id),

  narrative_text      TEXT NOT NULL,

  -- Structured components used to build and potentially regenerate the narrative
  narrative_components JSONB DEFAULT '{}',

  pushed_to_document  BOOLEAN DEFAULT false,
  document_id         UUID REFERENCES documents(id),
  pushed_at           TIMESTAMPTZ,
  pushed_by           UUID REFERENCES auth.users(id),

  created_by          UUID REFERENCES auth.users(id),
  created_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_narratives_dag_id ON causal_narratives(dag_id);


-- RLS — mirror Phase A pattern
ALTER TABLE causal_estimation_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE causal_evalues             ENABLE ROW LEVEL SECURITY;
ALTER TABLE causal_narratives          ENABLE ROW LEVEL SECURITY;

CREATE POLICY "estimation_project_access" ON causal_estimation_results
  FOR ALL USING (
    project_id IN (
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "evalues_project_access" ON causal_evalues
  FOR ALL USING (
    project_id IN (
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "narratives_project_access" ON causal_narratives
  FOR ALL USING (
    project_id IN (
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
    )
  );
