-- ════════════════════════════════════════
-- H2: Fix overly permissive RLS
-- ════════════════════════════════════════

-- ────────────────────────────────────────
-- Helper: membership check subquery (reused below)
-- A user "can access project P" iff they own it or are a project_member.
-- ────────────────────────────────────────


-- ════════════════════════════════════════
-- PROJECTS
-- ════════════════════════════════════════

-- 1. Scope SELECT to exclude soft-deleted rows
DROP POLICY IF EXISTS "Projects visible to owner and members" ON projects;
CREATE POLICY "Projects visible to owner and members" ON projects
  FOR SELECT TO authenticated USING (
    deleted_at IS NULL
    AND (
      owner_id = auth.uid()
      OR id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid())
    )
  );

-- 2. Allow PIs and project owners to update (not just the owner)
DROP POLICY IF EXISTS "Owners can update their projects" ON projects;
CREATE POLICY "Owners and PIs can update projects" ON projects
  FOR UPDATE TO authenticated USING (
    owner_id = auth.uid()
    OR id IN (
      SELECT project_id FROM project_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'pi')
    )
  );

-- 3. Soft-delete guard: only non-deleted projects can be "hard-deleted" by owner
--    (in practice the app sets deleted_at; keep the hard-delete policy for safety)
DROP POLICY IF EXISTS "Owners can delete their projects" ON projects;
CREATE POLICY "Owners can delete their projects" ON projects
  FOR DELETE TO authenticated USING (owner_id = auth.uid());


-- ════════════════════════════════════════
-- DOCUMENT COMMENTS
-- ════════════════════════════════════════

-- Drop the open SELECT
DROP POLICY IF EXISTS "Document comments viewable by authenticated" ON document_comments;

-- Scope SELECT to users who are members of the document's project
CREATE POLICY "Document comments visible to project members" ON document_comments
  FOR SELECT TO authenticated USING (
    document_id IN (
      SELECT d.id FROM documents d
      WHERE d.project_id IN (
        SELECT project_id FROM project_members WHERE user_id = auth.uid()
        UNION SELECT id FROM projects WHERE owner_id = auth.uid()
      )
    )
  );

-- Scope INSERT: must be a project member to comment
DROP POLICY IF EXISTS "Authenticated can create comments" ON document_comments;
CREATE POLICY "Project members can create comments" ON document_comments
  FOR INSERT TO authenticated WITH CHECK (
    author_id = auth.uid()
    AND document_id IN (
      SELECT d.id FROM documents d
      WHERE d.project_id IN (
        SELECT project_id FROM project_members WHERE user_id = auth.uid()
        UNION SELECT id FROM projects WHERE owner_id = auth.uid()
      )
    )
  );

-- Authors can update their own comments
-- (existing policy is correct, keep it; DROP+CREATE to be explicit)
DROP POLICY IF EXISTS "Authors can update own comments" ON document_comments;
CREATE POLICY "Authors can update own comments" ON document_comments
  FOR UPDATE TO authenticated USING (author_id = auth.uid());

-- Authors can delete their own comments
CREATE POLICY "Authors can delete own comments" ON document_comments
  FOR DELETE TO authenticated USING (author_id = auth.uid());


-- ════════════════════════════════════════
-- REVIEW COMMENTS
-- ════════════════════════════════════════

-- Drop the open SELECT
DROP POLICY IF EXISTS "Review comments viewable by authenticated" ON review_comments;

-- Scope SELECT to participants of the parent review
CREATE POLICY "Review comments visible to review participants" ON review_comments
  FOR SELECT TO authenticated USING (
    review_id IN (
      SELECT id FROM review_requests
      WHERE assigned_to = auth.uid() OR requested_by = auth.uid()
    )
  );

-- Scope INSERT: must be a review participant
DROP POLICY IF EXISTS "Authenticated can create review comments" ON review_comments;
CREATE POLICY "Review participants can create review comments" ON review_comments
  FOR INSERT TO authenticated WITH CHECK (
    author_id = auth.uid()
    AND review_id IN (
      SELECT id FROM review_requests
      WHERE assigned_to = auth.uid() OR requested_by = auth.uid()
    )
  );

-- Authors can update and delete their own review comments
CREATE POLICY "Authors can update own review comments" ON review_comments
  FOR UPDATE TO authenticated USING (author_id = auth.uid());

CREATE POLICY "Authors can delete own review comments" ON review_comments
  FOR DELETE TO authenticated USING (author_id = auth.uid());


-- ════════════════════════════════════════
-- APPROVAL GATES
-- ════════════════════════════════════════

-- Drop the open SELECT and the stale ALL policy (referenced 'supervisor')
DROP POLICY IF EXISTS "Approval gates viewable by authenticated" ON approval_gates;
DROP POLICY IF EXISTS "Supervisors can manage approval gates" ON approval_gates;

-- Scope SELECT to project members only
CREATE POLICY "Approval gates visible to project members" ON approval_gates
  FOR SELECT TO authenticated USING (
    project_id IN (
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
      UNION SELECT id FROM projects WHERE owner_id = auth.uid()
    )
  );

-- PIs, coordinators, and admins can insert new gates
CREATE POLICY "PIs and admins can create approval gates" ON approval_gates
  FOR INSERT TO authenticated WITH CHECK (
    project_id IN (
      SELECT project_id FROM project_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'pi')
      UNION SELECT id FROM projects WHERE owner_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('pi', 'coordinator', 'admin')
    )
  );

-- PIs, coordinators, and admins can approve/update gates for their projects
CREATE POLICY "PIs and admins can update approval gates" ON approval_gates
  FOR UPDATE TO authenticated USING (
    project_id IN (
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
      UNION SELECT id FROM projects WHERE owner_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('pi', 'coordinator', 'admin')
    )
  );

-- Only admins and project owners can delete gates
CREATE POLICY "Admins can delete approval gates" ON approval_gates
  FOR DELETE TO authenticated USING (
    project_id IN (SELECT id FROM projects WHERE owner_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );
