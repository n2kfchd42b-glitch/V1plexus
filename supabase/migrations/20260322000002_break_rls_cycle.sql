-- ════════════════════════════════════════
-- Break the projects ↔ project_members RLS cycle (for real this time)
-- ════════════════════════════════════════
--
-- Root cause: project_members has TWO policies that cover SELECT:
--   1. "Project members visible to project members" (fixed in v2 to use
--      auth_user_owns_project — a SECURITY DEFINER function)
--   2. "Project owners can manage members" (FOR ALL, from 001_initial.sql)
--      which still directly sub-selects `projects`, reintroducing the cycle.
--
-- Additionally, the `projects` SELECT policy directly sub-selects
-- `project_members`, so we need SECURITY DEFINER helpers on BOTH sides
-- to fully break the cycle.
-- ════════════════════════════════════════

-- ── 1. SECURITY DEFINER helper: check project membership without RLS ──
CREATE OR REPLACE FUNCTION auth_user_is_project_member(p_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM project_members
    WHERE project_id = p_id AND user_id = auth.uid()
  );
$$;

-- ── 2. Fix projects SELECT policy to use the helper ──
DROP POLICY IF EXISTS "Projects visible to owner and members" ON projects;

CREATE POLICY "Projects visible to owner and members" ON projects
  FOR SELECT TO authenticated USING (
    deleted_at IS NULL
    AND (
      owner_id = auth.uid()
      OR auth_user_is_project_member(id)
    )
  );

-- ── 3. Drop the FOR ALL policy that was causing the cycle on SELECT ──
DROP POLICY IF EXISTS "Project owners can manage members" ON project_members;

-- Replace with separate INSERT / UPDATE / DELETE policies that use the
-- SECURITY DEFINER function (no direct subquery on `projects`).
CREATE POLICY "Project owners can add members" ON project_members
  FOR INSERT TO authenticated WITH CHECK (
    auth_user_owns_project(project_id)
  );

CREATE POLICY "Project owners can update members" ON project_members
  FOR UPDATE TO authenticated USING (
    auth_user_owns_project(project_id)
  );

CREATE POLICY "Project owners can remove members" ON project_members
  FOR DELETE TO authenticated USING (
    auth_user_owns_project(project_id)
  );

-- ── 4. Fix projects UPDATE policy (010 also used a direct subquery) ──
DROP POLICY IF EXISTS "Owners and PIs can update projects" ON projects;

CREATE POLICY "Owners and PIs can update projects" ON projects
  FOR UPDATE TO authenticated USING (
    owner_id = auth.uid()
    OR auth_user_is_project_member(id)
  );

-- ── 5. Fix document-related policies that sub-select project_members ──
--    Use the same SECURITY DEFINER helpers to avoid triggering RLS.

-- Helper: checks if current user can access a project (owner OR member)
CREATE OR REPLACE FUNCTION auth_user_can_access_project(p_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    EXISTS (SELECT 1 FROM projects WHERE id = p_id AND owner_id = auth.uid())
    OR
    EXISTS (SELECT 1 FROM project_members WHERE project_id = p_id AND user_id = auth.uid())
  );
$$;

-- Documents SELECT
DROP POLICY IF EXISTS "Documents visible to project members" ON documents;
CREATE POLICY "Documents visible to project members" ON documents
  FOR SELECT TO authenticated USING (
    auth_user_can_access_project(project_id)
  );

-- Documents INSERT
DROP POLICY IF EXISTS "Project members can create documents" ON documents;
CREATE POLICY "Project members can create documents" ON documents
  FOR INSERT TO authenticated WITH CHECK (
    auth_user_can_access_project(project_id)
  );

-- Document versions SELECT
DROP POLICY IF EXISTS "Document versions visible to project members" ON document_versions;
CREATE POLICY "Document versions visible to project members" ON document_versions
  FOR SELECT TO authenticated USING (
    document_id IN (
      SELECT id FROM documents WHERE auth_user_can_access_project(project_id)
    )
  );

-- Document versions INSERT (from 015, may not be applied yet)
DROP POLICY IF EXISTS "Project members can create versions" ON document_versions;
DROP POLICY IF EXISTS "Document creators can create versions" ON document_versions;
CREATE POLICY "Project members can create versions" ON document_versions
  FOR INSERT TO authenticated WITH CHECK (
    document_id IN (
      SELECT id FROM documents WHERE auth_user_can_access_project(project_id)
    )
  );

-- Document comments SELECT (from 010)
DROP POLICY IF EXISTS "Document comments visible to project members" ON document_comments;
CREATE POLICY "Document comments visible to project members" ON document_comments
  FOR SELECT TO authenticated USING (
    document_id IN (
      SELECT id FROM documents WHERE auth_user_can_access_project(project_id)
    )
  );

-- Document comments INSERT (from 010)
DROP POLICY IF EXISTS "Project members can create comments" ON document_comments;
CREATE POLICY "Project members can create comments" ON document_comments
  FOR INSERT TO authenticated WITH CHECK (
    author_id = auth.uid()
    AND document_id IN (
      SELECT id FROM documents WHERE auth_user_can_access_project(project_id)
    )
  );

-- Review requests INSERT (from 015, may not be applied yet)
DROP POLICY IF EXISTS "Project members can create reviews" ON review_requests;
DROP POLICY IF EXISTS "Authenticated can create reviews" ON review_requests;
CREATE POLICY "Project members can create reviews" ON review_requests
  FOR INSERT TO authenticated WITH CHECK (
    requested_by = auth.uid()
    AND document_id IN (
      SELECT id FROM documents WHERE auth_user_can_access_project(project_id)
    )
  );

-- Approval gates SELECT (from 010)
DROP POLICY IF EXISTS "Approval gates visible to project members" ON approval_gates;
CREATE POLICY "Approval gates visible to project members" ON approval_gates
  FOR SELECT TO authenticated USING (
    auth_user_can_access_project(project_id)
  );

-- Approval gates INSERT (from 010)
DROP POLICY IF EXISTS "PIs and admins can create approval gates" ON approval_gates;
CREATE POLICY "PIs and admins can create approval gates" ON approval_gates
  FOR INSERT TO authenticated WITH CHECK (
    auth_user_can_access_project(project_id)
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('pi', 'coordinator', 'admin')
    )
  );

-- Approval gates UPDATE (from 010)
DROP POLICY IF EXISTS "PIs and admins can update approval gates" ON approval_gates;
CREATE POLICY "PIs and admins can update approval gates" ON approval_gates
  FOR UPDATE TO authenticated USING (
    auth_user_can_access_project(project_id)
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('pi', 'coordinator', 'admin')
    )
  );

-- Approval gates DELETE (from 010)
DROP POLICY IF EXISTS "Admins can delete approval gates" ON approval_gates;
CREATE POLICY "Admins can delete approval gates" ON approval_gates
  FOR DELETE TO authenticated USING (
    auth_user_owns_project(project_id)
    OR EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Ethics applications SELECT (from 002)
DROP POLICY IF EXISTS "Ethics visible to project members" ON ethics_applications;
CREATE POLICY "Ethics visible to project members" ON ethics_applications
  FOR SELECT TO authenticated USING (
    auth_user_can_access_project(project_id)
  );

-- Ethics applications ALL (from 002)
DROP POLICY IF EXISTS "Project members can manage ethics" ON ethics_applications;
CREATE POLICY "Project owners can manage ethics" ON ethics_applications
  FOR ALL TO authenticated USING (
    auth_user_owns_project(project_id)
  );

-- Ethics amendments SELECT (from 002)
DROP POLICY IF EXISTS "Amendments visible to project members" ON ethics_amendments;
CREATE POLICY "Amendments visible to project members" ON ethics_amendments
  FOR SELECT TO authenticated USING (
    application_id IN (
      SELECT id FROM ethics_applications WHERE auth_user_can_access_project(project_id)
    )
  );

-- Ethics amendments ALL (from 002)
DROP POLICY IF EXISTS "Project owners can manage amendments" ON ethics_amendments;
CREATE POLICY "Project owners can manage amendments" ON ethics_amendments
  FOR ALL TO authenticated USING (
    application_id IN (
      SELECT id FROM ethics_applications WHERE auth_user_owns_project(project_id)
    )
  );

-- Ethics documents SELECT (from 002)
DROP POLICY IF EXISTS "Ethics documents visible to project members" ON ethics_documents;
CREATE POLICY "Ethics documents visible to project members" ON ethics_documents
  FOR SELECT TO authenticated USING (
    application_id IN (
      SELECT id FROM ethics_applications WHERE auth_user_can_access_project(project_id)
    )
  );

-- Ethics documents INSERT (from 002)
DROP POLICY IF EXISTS "Project members can upload ethics documents" ON ethics_documents;
CREATE POLICY "Project members can upload ethics documents" ON ethics_documents
  FOR INSERT TO authenticated WITH CHECK (
    application_id IN (
      SELECT id FROM ethics_applications WHERE auth_user_can_access_project(project_id)
    )
  );
