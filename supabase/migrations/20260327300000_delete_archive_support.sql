-- Add soft-delete support to analysis_runs
ALTER TABLE analysis_runs ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Add archive support to datasets
ALTER TABLE datasets ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

-- Allow project members/owners to delete their own analysis runs
CREATE POLICY "Analysis creators can delete" ON analysis_runs
  FOR DELETE TO authenticated USING (created_by = auth.uid());
