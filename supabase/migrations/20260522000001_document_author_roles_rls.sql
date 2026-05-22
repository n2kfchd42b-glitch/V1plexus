-- Add missing INSERT and DELETE RLS policies for document_author_roles.
-- The original migration only had SELECT and UPDATE policies, causing 500s
-- when the document owner tried to add or remove co-authors.
-- Also broaden the UPDATE policy so document/project owners can save CRediT roles.

-- ── INSERT ────────────────────────────────────────────────────────────────────
-- The person inserting must be the document creator or project owner,
-- and added_by must equal the authenticated user (prevents spoofing).
CREATE POLICY "Document owners can add authors"
  ON document_author_roles
  FOR INSERT TO authenticated
  WITH CHECK (
    added_by = auth.uid()
    AND document_id IN (
      SELECT d.id FROM documents d
      WHERE d.created_by = auth.uid()
         OR d.project_id IN (
           SELECT id FROM projects WHERE owner_id = auth.uid()
         )
    )
  );

-- ── DELETE ────────────────────────────────────────────────────────────────────
CREATE POLICY "Document owners can remove authors"
  ON document_author_roles
  FOR DELETE TO authenticated
  USING (
    document_id IN (
      SELECT d.id FROM documents d
      WHERE d.created_by = auth.uid()
         OR d.project_id IN (
           SELECT id FROM projects WHERE owner_id = auth.uid()
         )
    )
  );

-- ── UPDATE (broaden) ──────────────────────────────────────────────────────────
-- Original policy only allowed the listed author to update their own row.
-- Document/project owners also need to update (e.g. save CRediT roles, reorder).
DROP POLICY IF EXISTS "Document authors can update their own roles" ON document_author_roles;

CREATE POLICY "Authors and owners can update roles"
  ON document_author_roles
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR document_id IN (
      SELECT d.id FROM documents d
      WHERE d.created_by = auth.uid()
         OR d.project_id IN (
           SELECT id FROM projects WHERE owner_id = auth.uid()
         )
    )
  );
