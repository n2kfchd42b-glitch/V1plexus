-- Extend SECURITY DEFINER viewer read access to dataset_versions.
-- The existing inline-subquery policy silently fails for supervisor viewers.

DROP POLICY IF EXISTS "Supervisor viewers can read dataset versions" ON dataset_versions;
CREATE POLICY "Supervisor viewers can read dataset versions" ON dataset_versions
  FOR SELECT TO authenticated
  USING (
    dataset_id IN (
      SELECT id FROM datasets WHERE auth_user_is_project_viewer(project_id)
    )
  );
