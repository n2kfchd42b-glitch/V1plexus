-- ============================================================
-- Phase 9: Publication Pipeline
-- Journal submissions, citations, preregistration, DOI minting
-- ============================================================

CREATE TABLE IF NOT EXISTS journal_templates (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name            TEXT NOT NULL,
  publisher       TEXT,
  issn            TEXT,
  impact_factor   DECIMAL(5,2),
  open_access     BOOLEAN DEFAULT false,
  formatting      JSONB NOT NULL DEFAULT '{}',
  submission_url  TEXT,
  guidelines_url  TEXT,
  categories      TEXT[] DEFAULT '{}',
  is_verified     BOOLEAN DEFAULT true,
  contributed_by  UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS project_citations (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  citation_data   JSONB NOT NULL,
  source          TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'crossref', 'doi', 'pubmed', 'bibtex', 'openalex')),
  external_id     TEXT,
  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS journal_submissions (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id     UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  project_id      UUID REFERENCES projects(id) ON DELETE CASCADE,
  journal_id      UUID REFERENCES journal_templates(id),
  journal_name    TEXT NOT NULL,
  status          TEXT DEFAULT 'preparing' CHECK (status IN (
                    'preparing', 'submitted', 'under_review', 'revision_requested',
                    'revision_submitted', 'accepted', 'rejected', 'published', 'withdrawn'
                  )),
  submission_id   TEXT,
  submitted_at    TIMESTAMPTZ,
  response_at     TIMESTAMPTZ,
  published_at    TIMESTAMPTZ,
  published_doi   TEXT,
  published_url   TEXT,
  cover_letter    TEXT,
  notes           TEXT,
  revision_count  INTEGER DEFAULT 0,
  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS protocol_registrations (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id       UUID NOT NULL REFERENCES documents(id),
  project_id        UUID REFERENCES projects(id) ON DELETE CASCADE,
  document_version  INTEGER NOT NULL DEFAULT 1,
  registration_id   TEXT UNIQUE NOT NULL,
  title             TEXT NOT NULL,
  authors           JSONB NOT NULL DEFAULT '[]',
  abstract          TEXT,
  study_design      TEXT,
  registered_at     TIMESTAMPTZ DEFAULT now(),
  content_hash      TEXT NOT NULL,
  is_public         BOOLEAN DEFAULT true,
  amendments        JSONB DEFAULT '[]',
  created_by        UUID REFERENCES profiles(id)
);

CREATE TABLE IF NOT EXISTS dataset_publications (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  dataset_id        UUID NOT NULL REFERENCES datasets(id),
  version_id        UUID REFERENCES dataset_versions(id),
  doi               TEXT UNIQUE,
  reserved_doi      TEXT,
  title             TEXT NOT NULL,
  authors           JSONB NOT NULL DEFAULT '[]',
  description       TEXT,
  license           TEXT DEFAULT 'CC-BY-4.0' CHECK (license IN (
                      'CC-BY-4.0', 'CC-BY-SA-4.0', 'CC-BY-NC-4.0', 'CC0', 'custom'
                    )),
  keywords          TEXT[] DEFAULT '{}',
  geographic_scope  TEXT,
  embargo_until     DATE,
  citation_text     TEXT,
  datacite_metadata JSONB,
  status            TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'reserved', 'published')),
  published_at      TIMESTAMPTZ,
  created_by        UUID REFERENCES profiles(id),
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_citations_project   ON project_citations(project_id);
CREATE INDEX IF NOT EXISTS idx_citations_ext_id    ON project_citations(external_id) WHERE external_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_submissions_doc     ON journal_submissions(document_id);
CREATE INDEX IF NOT EXISTS idx_submissions_project ON journal_submissions(project_id);
CREATE INDEX IF NOT EXISTS idx_reg_id              ON protocol_registrations(registration_id);
CREATE INDEX IF NOT EXISTS idx_reg_project         ON protocol_registrations(project_id);
CREATE INDEX IF NOT EXISTS idx_dataset_pubs_doi    ON dataset_publications(doi) WHERE doi IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_dataset_pubs_ds     ON dataset_publications(dataset_id);

ALTER TABLE journal_templates      ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_citations      ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_submissions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE protocol_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE dataset_publications   ENABLE ROW LEVEL SECURITY;

-- Journal templates: readable by all authenticated users, writable by admins
CREATE POLICY "journal_templates_read" ON journal_templates
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "journal_templates_insert" ON journal_templates
  FOR INSERT TO authenticated WITH CHECK (true);

-- Citations: project members
CREATE POLICY "citations_select" ON project_citations
  FOR SELECT TO authenticated
  USING (
    project_id IN (
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "citations_insert" ON project_citations
  FOR INSERT TO authenticated
  WITH CHECK (
    project_id IN (
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "citations_delete" ON project_citations
  FOR DELETE TO authenticated
  USING (created_by = auth.uid());

-- Submissions: project members
CREATE POLICY "submissions_select" ON journal_submissions
  FOR SELECT TO authenticated
  USING (
    project_id IN (
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "submissions_insert" ON journal_submissions
  FOR INSERT TO authenticated
  WITH CHECK (
    project_id IN (
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "submissions_update" ON journal_submissions
  FOR UPDATE TO authenticated
  USING (
    project_id IN (
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
    )
  );

-- Protocol registrations: public ones are readable by anyone via service role
-- Private ones are readable by project members
CREATE POLICY "registrations_select" ON protocol_registrations
  FOR SELECT TO authenticated
  USING (
    is_public = true
    OR project_id IN (
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "registrations_insert" ON protocol_registrations
  FOR INSERT TO authenticated
  WITH CHECK (
    project_id IN (
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
    )
  );

-- Dataset publications: project members
CREATE POLICY "dataset_pubs_select" ON dataset_publications
  FOR SELECT TO authenticated
  USING (
    dataset_id IN (
      SELECT d.id FROM datasets d
      JOIN project_members pm ON pm.project_id = d.project_id
      WHERE pm.user_id = auth.uid()
    )
  );

CREATE POLICY "dataset_pubs_insert" ON dataset_publications
  FOR INSERT TO authenticated
  WITH CHECK (
    dataset_id IN (
      SELECT d.id FROM datasets d
      JOIN project_members pm ON pm.project_id = d.project_id
      WHERE pm.user_id = auth.uid()
    )
  );

CREATE POLICY "dataset_pubs_update" ON dataset_publications
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid());

-- Sequence for generating registration IDs
CREATE SEQUENCE IF NOT EXISTS protocol_registration_seq START 1;

-- Helper to generate registration IDs in PLXR-YYYY-NNNNN format
CREATE OR REPLACE FUNCTION generate_registration_id()
RETURNS TEXT AS $$
DECLARE
  seq_val BIGINT;
  year_str TEXT;
BEGIN
  seq_val := nextval('protocol_registration_seq');
  year_str := to_char(now(), 'YYYY');
  RETURN 'PLXR-' || year_str || '-' || lpad(seq_val::text, 5, '0');
END;
$$ LANGUAGE plpgsql;
