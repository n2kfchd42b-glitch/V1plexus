-- ================================================================
-- Explicit read access for supervisor viewers on datasets,
-- documents, and analysis_runs.
--
-- The existing policies use inline subqueries into project_members
-- which CAN silently fail in some Postgres environments when the
-- calling user's project_members row was recently inserted.
-- These SECURITY DEFINER helper policies guarantee access for
-- any user who is an explicit viewer on a project.
-- ================================================================

-- Helper: is the current user a viewer (or higher) on a project?
CREATE OR REPLACE FUNCTION auth_user_is_project_viewer(p_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM project_members
    WHERE project_id = p_id
      AND user_id    = auth.uid()
  );
$$;

-- ── datasets ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Supervisor viewers can read datasets" ON datasets;
CREATE POLICY "Supervisor viewers can read datasets" ON datasets
  FOR SELECT TO authenticated
  USING (auth_user_is_project_viewer(project_id));

-- ── documents ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Supervisor viewers can read documents" ON documents;
CREATE POLICY "Supervisor viewers can read documents" ON documents
  FOR SELECT TO authenticated
  USING (auth_user_is_project_viewer(project_id));

-- ── analysis_runs ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Supervisor viewers can read analysis" ON analysis_runs;
CREATE POLICY "Supervisor viewers can read analysis" ON analysis_runs
  FOR SELECT TO authenticated
  USING (auth_user_is_project_viewer(project_id));
