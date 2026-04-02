-- Phase 4: Analysis Integrity Layer
-- Statistical assumption verification and blind re-entry validation

-- TABLE 1: analysis_assumption_checks
CREATE TABLE public.analysis_assumption_checks (
  id UUID DEFAULT gen_random_uuid()
    PRIMARY KEY,

  -- The analysis run this belongs to (can be NULL initially)
  analysis_run_id UUID
    REFERENCES analysis_runs(id)
    ON DELETE CASCADE,

  dataset_id UUID NOT NULL
    REFERENCES datasets(id)
    ON DELETE CASCADE,

  version_id UUID NOT NULL
    REFERENCES dataset_versions(id)
    ON DELETE CASCADE,

  project_id UUID NOT NULL
    REFERENCES projects(id)
    ON DELETE CASCADE,

  analysis_type TEXT NOT NULL,
  -- e.g. 'logistic_regression', 'kaplan_meier', 'chi_square' etc.

  requested_by UUID NOT NULL
    REFERENCES profiles(id)
    ON DELETE CASCADE,

  -- Array of assumption check objects (JSON)
  checks JSONB NOT NULL DEFAULT '[]',

  -- Overall pass/fail
  all_passed BOOLEAN NOT NULL,

  -- Has researcher reviewed and acknowledged violations
  acknowledged BOOLEAN NOT NULL DEFAULT false,
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID REFERENCES profiles(id) ON DELETE SET NULL,

  -- The audit entry ID written when researcher acknowledged
  acknowledgement_audit_id UUID,

  -- Whether analysis was allowed to proceed
  analysis_proceeded BOOLEAN NOT NULL DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_assumption_version
  ON analysis_assumption_checks(version_id, analysis_type);

CREATE INDEX idx_assumption_run
  ON analysis_assumption_checks(analysis_run_id)
  WHERE analysis_run_id IS NOT NULL;

CREATE INDEX idx_assumption_project
  ON analysis_assumption_checks(project_id, created_at DESC);

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON analysis_assumption_checks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE analysis_assumption_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Researchers see own checks"
  ON analysis_assumption_checks FOR SELECT TO authenticated
  USING (
    requested_by = auth.uid()
    OR project_id IN (
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Researchers create checks"
  ON analysis_assumption_checks FOR INSERT TO authenticated
  WITH CHECK (requested_by = auth.uid());

CREATE POLICY "Researchers update own checks"
  ON analysis_assumption_checks FOR UPDATE TO authenticated
  USING (requested_by = auth.uid());

-- TABLE 2: reentry_sessions
CREATE TABLE public.reentry_sessions (
  id UUID DEFAULT gen_random_uuid()
    PRIMARY KEY,

  dataset_id UUID NOT NULL
    REFERENCES datasets(id)
    ON DELETE CASCADE,

  project_id UUID NOT NULL
    REFERENCES projects(id)
    ON DELETE CASCADE,

  -- The original dataset version being validated
  original_version_id UUID NOT NULL
    REFERENCES dataset_versions(id)
    ON DELETE CASCADE,

  -- The re-entered dataset version
  reentry_version_id UUID
    REFERENCES dataset_versions(id)
    ON DELETE SET NULL,

  -- Who initiated the session
  initiated_by UUID NOT NULL
    REFERENCES profiles(id)
    ON DELETE CASCADE,

  -- Who is doing the re-entry
  reentry_assigned_to UUID
    REFERENCES profiles(id)
    ON DELETE SET NULL,

  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN (
      'pending',
      'reentry_submitted',
      'comparing',
      'discrepancies_found',
      'resolved',
      'validated'
    )),

  -- Columns to validate (NULL = all non-id columns)
  columns_to_validate TEXT[],

  -- Participant ID column for matching
  participant_id_column TEXT NOT NULL,

  -- Comparison results (NULL until comparison runs)
  comparison_result JSONB DEFAULT NULL,

  -- Final verified version
  verified_version_id UUID
    REFERENCES dataset_versions(id)
    ON DELETE SET NULL,

  -- Agreement statistics
  overall_agreement_pct DECIMAL(5,2) DEFAULT NULL,

  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_reentry_dataset
  ON reentry_sessions(dataset_id, status);

CREATE INDEX idx_reentry_project
  ON reentry_sessions(project_id, created_at DESC);

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON reentry_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE reentry_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project members see sessions"
  ON reentry_sessions FOR SELECT TO authenticated
  USING (
    project_id IN (
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
      UNION
      SELECT id FROM projects WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Members create sessions"
  ON reentry_sessions FOR INSERT TO authenticated
  WITH CHECK (initiated_by = auth.uid());

CREATE POLICY "Participants update sessions"
  ON reentry_sessions FOR UPDATE TO authenticated
  USING (
    initiated_by = auth.uid()
    OR reentry_assigned_to = auth.uid()
  );

-- TABLE 3: reentry_discrepancies
CREATE TABLE public.reentry_discrepancies (
  id UUID DEFAULT gen_random_uuid()
    PRIMARY KEY,

  session_id UUID NOT NULL
    REFERENCES reentry_sessions(id)
    ON DELETE CASCADE,

  -- The participant this discrepancy belongs to
  participant_id TEXT NOT NULL,

  -- Which column
  column_name TEXT NOT NULL,

  -- Values from each entry
  original_value TEXT,
  reentry_value TEXT,

  -- Resolution status
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN (
      'pending',
      'resolved_original',
      'resolved_reentry',
      'resolved_manual',
      'flagged_for_investigation'
    )),

  -- The value chosen after resolution
  resolved_value TEXT,

  -- Who resolved it
  resolved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,

  -- Reason for resolution choice
  resolution_note TEXT,

  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_discrepancy_session
  ON reentry_discrepancies(session_id, status);

CREATE INDEX idx_discrepancy_column
  ON reentry_discrepancies(session_id, column_name);

ALTER TABLE reentry_discrepancies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Session participants see discrepancies"
  ON reentry_discrepancies FOR SELECT TO authenticated
  USING (
    session_id IN (
      SELECT id FROM reentry_sessions
      WHERE initiated_by = auth.uid()
      OR reentry_assigned_to = auth.uid()
      OR project_id IN (
        SELECT project_id FROM project_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Resolvers update discrepancies"
  ON reentry_discrepancies FOR UPDATE TO authenticated
  USING (
    session_id IN (
      SELECT id FROM reentry_sessions
      WHERE initiated_by = auth.uid()
      OR reentry_assigned_to = auth.uid()
    )
  );

-- Add analysis_check_id column to analysis_runs if not present
-- This links analysis runs to their assumption checks
ALTER TABLE analysis_runs
  ADD COLUMN IF NOT EXISTS assumption_check_id UUID
    REFERENCES analysis_assumption_checks(id)
    ON DELETE SET NULL;
