-- ════════════════════════════════════════
-- Fix infinite RLS recursion on project_members
-- ════════════════════════════════════════
--
-- The original SELECT policy was:
--   project_id IN (
--     SELECT id FROM projects WHERE owner_id = auth.uid()
--     UNION SELECT project_id FROM project_members WHERE user_id = auth.uid()
--   )
--
-- The second UNION branch is self-referential: project_members SELECT policy
-- queries project_members, which triggers the same policy again → infinite
-- recursion → PostgreSQL error → PostgREST 500 on every table whose RLS
-- subqueries project_members (projects, documents, review_requests, etc.).
--
-- Fix: a user only needs to see rows where they ARE the member.
-- Project owners can also see all members of their projects.
-- ════════════════════════════════════════

DROP POLICY IF EXISTS "Project members visible to project members" ON project_members;

CREATE POLICY "Project members visible to project members" ON project_members
  FOR SELECT TO authenticated USING (
    user_id = auth.uid()
    OR project_id IN (SELECT id FROM projects WHERE owner_id = auth.uid())
  );
