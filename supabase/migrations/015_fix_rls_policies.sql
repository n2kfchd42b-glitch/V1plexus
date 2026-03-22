-- ────────────────────────────────────────────────────────────────────────────
-- 015 — Fix RLS INSERT policies for document_versions and review_requests
-- ────────────────────────────────────────────────────────────────────────────

-- M4: document_versions INSERT — the original policy only checked that the
--     requestor was the document's creator, so any authenticated user could
--     create versions for documents they can merely read.  Replace it with a
--     project-membership check (same guard used by the SELECT policy).
DROP POLICY IF EXISTS "Document creators can create versions" ON document_versions;

CREATE POLICY "Project members can create versions" ON document_versions
  FOR INSERT TO authenticated WITH CHECK (
    document_id IN (
      SELECT d.id FROM documents d
      WHERE d.project_id IN (
        SELECT project_id FROM project_members WHERE user_id = auth.uid()
        UNION SELECT id FROM projects WHERE owner_id = auth.uid()
      )
    )
  );

-- M11: review_requests INSERT — the original policy allowed any authenticated
--      user to create a review request as long as requested_by = auth.uid().
--      Replace it with a check that also verifies the requestor is a member
--      of the project that owns the document being reviewed.
DROP POLICY IF EXISTS "Authenticated can create reviews" ON review_requests;

CREATE POLICY "Project members can create reviews" ON review_requests
  FOR INSERT TO authenticated WITH CHECK (
    requested_by = auth.uid()
    AND document_id IN (
      SELECT d.id FROM documents d
      WHERE d.project_id IN (
        SELECT project_id FROM project_members WHERE user_id = auth.uid()
        UNION SELECT id FROM projects WHERE owner_id = auth.uid()
      )
    )
  );
