-- ════════════════════════════════════════
-- M5: Fix document UPDATE policy
-- Previous policy restricted UPDATE to the document creator only.
-- All project members (owner, pi, member) should be able to edit documents.
-- Viewers retain read-only access via the existing SELECT policy.
-- ════════════════════════════════════════

DROP POLICY IF EXISTS "Document creators can update" ON documents;

CREATE POLICY "Project members can update documents" ON documents
  FOR UPDATE TO authenticated USING (
    project_id IN (
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
      UNION SELECT id FROM projects WHERE owner_id = auth.uid()
    )
  );
