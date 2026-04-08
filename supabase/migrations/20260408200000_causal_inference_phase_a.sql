-- =============================================================================
-- PLEXUS Causal Inference Engine — Phase A
-- Stores DAG state, suggested/confirmed edges, and adjustment set results
-- =============================================================================

-- Stores the DAG for a given analysis session.
-- One active DAG per project+dataset combination at a time;
-- new confirmation replaces the previous.
CREATE TABLE causal_dags (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  dataset_id          UUID NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
  exposure_variable   TEXT NOT NULL,
  outcome_variable    TEXT NOT NULL,

  -- What the PC algorithm suggested
  -- [{from, to, confidence, direction_certain, involves_exposure, involves_outcome}]
  suggested_edges     JSONB NOT NULL DEFAULT '[]',

  -- What the researcher confirmed (may differ from suggested)
  -- [{from, to, user_action}]
  confirmed_edges     JSONB,

  -- Computed from confirmed DAG
  adjustment_set      TEXT[],       -- variables to adjust for
  mediators           TEXT[],       -- do NOT adjust for these
  colliders           TEXT[],       -- do NOT adjust for these
  instruments         TEXT[],       -- potential instrumental variables

  -- Status lifecycle
  status              TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN (
                        'pending',       -- algorithm running
                        'suggested',     -- algorithm done, awaiting review
                        'confirmed',     -- researcher confirmed
                        'rejected'       -- researcher rejected, started over
                      )),

  algorithm_used      TEXT DEFAULT 'pc',
  algorithm_params    JSONB DEFAULT '{}',

  confirmed_by        UUID REFERENCES auth.users(id),
  confirmed_at        TIMESTAMPTZ,
  created_by          UUID REFERENCES auth.users(id),
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

-- Fast lookup by project + dataset
CREATE INDEX idx_causal_dags_project_dataset
  ON causal_dags(project_id, dataset_id);

-- Audit: every edge decision is logged separately
CREATE TABLE causal_dag_edge_decisions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dag_id      UUID NOT NULL REFERENCES causal_dags(id) ON DELETE CASCADE,
  edge_from   TEXT NOT NULL,
  edge_to     TEXT NOT NULL,
  action      TEXT NOT NULL
              CHECK (action IN (
                'accepted',   -- researcher accepted algorithm suggestion
                'reversed',   -- researcher flipped direction
                'removed',    -- researcher removed algorithm edge
                'added'       -- researcher added edge algorithm missed
              )),
  decided_by  UUID REFERENCES auth.users(id),
  decided_at  TIMESTAMPTZ DEFAULT now()
);

-- RLS: users can only access DAGs in projects they belong to
ALTER TABLE causal_dags ENABLE ROW LEVEL SECURITY;
ALTER TABLE causal_dag_edge_decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "causal_dags_project_access" ON causal_dags
  FOR ALL USING (
    project_id IN (
      SELECT project_id FROM project_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "causal_dag_edges_via_dag" ON causal_dag_edge_decisions
  FOR ALL USING (
    dag_id IN (
      SELECT id FROM causal_dags WHERE project_id IN (
        SELECT project_id FROM project_members WHERE user_id = auth.uid()
      )
    )
  );

-- updated_at trigger
CREATE OR REPLACE FUNCTION update_causal_dags_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER causal_dags_updated_at
  BEFORE UPDATE ON causal_dags
  FOR EACH ROW EXECUTE FUNCTION update_causal_dags_updated_at();
