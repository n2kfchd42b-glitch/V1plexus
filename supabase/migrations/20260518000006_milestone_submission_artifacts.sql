-- Add dataset and analysis run links to milestone submissions.
-- document_id already exists from the initial migration.

ALTER TABLE milestone_submissions
  ADD COLUMN IF NOT EXISTS dataset_id       UUID REFERENCES datasets(id)      ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS analysis_run_id  UUID REFERENCES analysis_runs(id) ON DELETE SET NULL;
