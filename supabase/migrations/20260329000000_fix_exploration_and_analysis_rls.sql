-- Fix 1: dataset_explorations INSERT policy was missing project owner check.
-- Project owners who are not explicitly in project_members could not save chart explorations (403).
DROP POLICY IF EXISTS "Project members can create explorations" ON dataset_explorations;

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

-- Fix 2: analysis_runs UPDATE policy — add explicit created_by fallback so the
-- run creator can always update chart_config even if project membership check is slow.
DROP POLICY IF EXISTS "Project members can update analysis" ON analysis_runs;

CREATE POLICY "Project members can update analysis" ON analysis_runs
  FOR UPDATE TO authenticated USING (
    created_by = auth.uid()
    OR project_id IN (
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
      UNION SELECT id FROM projects WHERE owner_id = auth.uid()
    )
  );
