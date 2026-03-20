-- Phase 6: Full-text search vectors, export tracking, and SSO domain mapping

-- ============================================================
-- 1. Full-text search vectors
-- ============================================================

-- Projects: search by title + description
ALTER TABLE projects ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    to_tsvector('english',
      coalesce(title, '') || ' ' ||
      coalesce(description, '')
    )
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_projects_search ON projects USING gin(search_vector);

-- Documents: search by title
ALTER TABLE documents ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(title, ''))
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_documents_search ON documents USING gin(search_vector);

-- ============================================================
-- 2. Export audit log
-- ============================================================
CREATE TABLE IF NOT EXISTS document_exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  exported_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  format text NOT NULL CHECK (format IN ('docx', 'pdf', 'latex')),
  storage_path text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_doc_exports_document ON document_exports(document_id);
CREATE INDEX IF NOT EXISTS idx_doc_exports_user ON document_exports(exported_by);

-- RLS for document_exports
ALTER TABLE document_exports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own exports"
  ON document_exports FOR SELECT
  USING (exported_by = auth.uid());

CREATE POLICY "Users can create exports"
  ON document_exports FOR INSERT
  WITH CHECK (exported_by = auth.uid());

-- ============================================================
-- 3. Institution SSO configuration
-- ============================================================
CREATE TABLE IF NOT EXISTS institutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  logo_url text,
  sso_enabled boolean NOT NULL DEFAULT false,
  sso_provider_id text,            -- Supabase SSO provider ID after configuration
  sso_metadata_url text,
  sso_domains text[],              -- ['university.edu', 'hospital.org']
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS institution_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'admin', 'owner')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (institution_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_inst_members_institution ON institution_members(institution_id);
CREATE INDEX IF NOT EXISTS idx_inst_members_user ON institution_members(user_id);

-- RLS
ALTER TABLE institutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE institution_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Institution members can view their institution"
  ON institutions FOR SELECT
  USING (
    id IN (
      SELECT institution_id FROM institution_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Institution admins can update"
  ON institutions FOR UPDATE
  USING (
    id IN (
      SELECT institution_id FROM institution_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

CREATE POLICY "Authenticated users can create institutions"
  ON institutions FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Institution members can view membership"
  ON institution_members FOR SELECT
  USING (
    institution_id IN (
      SELECT institution_id FROM institution_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Institution admins can manage members"
  ON institution_members FOR ALL
  USING (
    institution_id IN (
      SELECT institution_id FROM institution_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

-- Updated_at trigger for institutions
CREATE OR REPLACE FUNCTION update_institutions_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER institutions_updated_at
  BEFORE UPDATE ON institutions
  FOR EACH ROW EXECUTE FUNCTION update_institutions_updated_at();

-- ============================================================
-- 4. Onboarding tracking on profiles
-- ============================================================
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS institution_id uuid REFERENCES institutions(id) ON DELETE SET NULL;

-- ============================================================
-- 5. Helper function: full-text search across entity types
-- ============================================================
CREATE OR REPLACE FUNCTION search_platform(
  search_query text,
  user_id_param uuid,
  result_limit int DEFAULT 20
)
RETURNS TABLE (
  entity_type text,
  entity_id uuid,
  title text,
  subtitle text,
  href text,
  rank real
) AS $$
BEGIN
  RETURN QUERY
  -- Projects
  SELECT
    'project'::text,
    p.id,
    p.title,
    coalesce(p.description, ''),
    '/projects/' || p.id,
    ts_rank(p.search_vector, plainto_tsquery('english', search_query))
  FROM projects p
  WHERE
    p.search_vector @@ plainto_tsquery('english', search_query)
    AND (p.owner_id = user_id_param OR p.id IN (
      SELECT project_id FROM project_members WHERE user_id = user_id_param
    ))

  UNION ALL

  -- Documents
  SELECT
    'document'::text,
    d.id,
    d.title,
    'Project document',
    '/projects/' || d.project_id || '/documents/' || d.id,
    ts_rank(d.search_vector, plainto_tsquery('english', search_query))
  FROM documents d
  WHERE
    d.search_vector @@ plainto_tsquery('english', search_query)
    AND (d.created_by = user_id_param OR d.project_id IN (
      SELECT project_id FROM project_members WHERE user_id = user_id_param
    ))

  ORDER BY rank DESC
  LIMIT result_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
