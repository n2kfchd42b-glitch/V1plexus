-- ════════════════════════════════════════
-- Fix mutual RLS recursion between projects ↔ project_members
-- ════════════════════════════════════════
--
-- Migration 014 removed the direct self-reference in project_members, but
-- introduced mutual recursion:
--
--   projects SELECT policy        → queries project_members
--   project_members SELECT policy → queries projects  (added in 014)
--
-- PostgreSQL detects this cycle and aborts every query on these tables
-- (and every table whose RLS references them: documents, review_requests, …)
-- with a 500 / infinite-recursion error.
--
-- Fix: replace the `projects` subquery in the project_members policy with a
-- SECURITY DEFINER function that runs as the table owner, bypassing RLS on
-- `projects` entirely. This breaks the cycle while preserving the intent
-- (project owners can see their project's member list).
-- ════════════════════════════════════════

-- 1. Security-definer helper: checks ownership without triggering projects RLS
CREATE OR REPLACE FUNCTION auth_user_owns_project(p_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM projects
    WHERE id = p_id AND owner_id = auth.uid()
  );
$$;

-- 2. Rebuild project_members SELECT policy using the helper
DROP POLICY IF EXISTS "Project members visible to project members" ON project_members;

CREATE POLICY "Project members visible to project members" ON project_members
  FOR SELECT TO authenticated USING (
    user_id = auth.uid()
    OR auth_user_owns_project(project_id)
  );
