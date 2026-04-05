-- ════════════════════════════════════════════════════════════════
-- PILLARS 1, 2, 5: Version Control, Citations, Authorship
-- Date: 2026-04-05
-- ════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════
-- PILLAR 1: Real-Time Collaboration + Version Control
-- ════════════════════════════════════════════════════════════════

-- Add new columns to document_versions for enhanced versioning
ALTER TABLE document_versions 
ADD COLUMN IF NOT EXISTS content_hash VARCHAR(64),
ADD COLUMN IF NOT EXISTS is_auto_save BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS label TEXT;

-- Create index on auto-saves for efficient filtering
CREATE INDEX IF NOT EXISTS idx_document_versions_auto_save 
  ON document_versions(document_id, is_auto_save) WHERE is_auto_save = true;

-- Presence tracking for active cursors and live collaboration
CREATE TABLE IF NOT EXISTS document_presence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cursor_position JSONB, -- { line, column }
  selection JSONB, -- { from, to }
  color VARCHAR(7), -- Hex color for cursor
  last_seen TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_document_presence_document ON document_presence(document_id);
CREATE INDEX idx_document_presence_user ON document_presence(user_id);

ALTER TABLE document_presence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can see presence in shared documents" ON document_presence
  FOR SELECT TO authenticated USING (
    document_id IN (
      SELECT d.id FROM documents d
      WHERE d.project_id IN (
        SELECT project_id FROM project_members WHERE user_id = auth.uid()
        UNION SELECT id FROM projects WHERE owner_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can update their own presence" ON document_presence
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own presence data" ON document_presence
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- ════════════════════════════════════════════════════════════════
-- PILLAR 2: Scientific Writing & Citation Management
-- ════════════════════════════════════════════════════════════════

-- Link documents to citations (tracks citation order in document)
CREATE TABLE IF NOT EXISTS document_citations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  citation_id UUID NOT NULL REFERENCES project_citations(id) ON DELETE CASCADE,
  reference_number INTEGER, -- Auto-assigned in document order
  inserted_by UUID REFERENCES auth.users(id),
  inserted_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(document_id, citation_id)
);

CREATE INDEX idx_document_citations_document ON document_citations(document_id);
CREATE INDEX idx_document_citations_citation ON document_citations(citation_id);

ALTER TABLE document_citations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can see document citations from shared documents" ON document_citations
  FOR SELECT TO authenticated USING (
    document_id IN (
      SELECT d.id FROM documents d
      WHERE d.project_id IN (
        SELECT project_id FROM project_members WHERE user_id = auth.uid()
        UNION SELECT id FROM projects WHERE owner_id = auth.uid()
      )
    )
  );

-- ════════════════════════════════════════════════════════════════
-- PILLAR 5: Authorship Transparency
-- ════════════════════════════════════════════════════════════════

-- Document authorship with CRediT taxonomy roles
CREATE TABLE IF NOT EXISTS document_author_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  display_name TEXT, -- For external authors without PLEXUS accounts
  email TEXT,
  orcid VARCHAR(20),
  institution TEXT,
  credit_roles TEXT[] DEFAULT '{}', -- CRediT taxonomy array
  contribution_order INTEGER NOT NULL DEFAULT 0, -- Author list position
  is_corresponding BOOLEAN DEFAULT false,
  confirmed_at TIMESTAMPTZ, -- NULL = unconfirmed
  confirmation_token UUID DEFAULT gen_random_uuid(), -- For email link
  confirmation_token_expires_at TIMESTAMPTZ DEFAULT (now() + interval '7 days'),
  added_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_document_author_roles_document ON document_author_roles(document_id);
CREATE INDEX idx_document_author_roles_user ON document_author_roles(user_id);
CREATE INDEX idx_document_author_roles_order ON document_author_roles(document_id, contribution_order);

ALTER TABLE document_author_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can see authors from shared documents" ON document_author_roles
  FOR SELECT TO authenticated USING (
    document_id IN (
      SELECT d.id FROM documents d
      WHERE d.project_id IN (
        SELECT project_id FROM project_members WHERE user_id = auth.uid()
        UNION SELECT id FROM projects WHERE owner_id = auth.uid()
      )
    )
  );

CREATE POLICY "Document authors can update their own roles" ON document_author_roles
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- ════════════════════════════════════════════════════════════════
-- FUNCTION: Generate content hash for version integrity
-- ════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION generate_content_hash()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.content_hash IS NULL THEN
    NEW.content_hash := encode(
      digest(NEW.content::text, 'sha256'),
      'hex'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER document_versions_hash_trigger
  BEFORE INSERT ON document_versions
  FOR EACH ROW
  EXECUTE FUNCTION generate_content_hash();

-- ════════════════════════════════════════════════════════════════
-- GRANTS & AUDIT LOGGING
-- ════════════════════════════════════════════════════════════════
GRANT SELECT, INSERT, UPDATE ON document_presence TO authenticated;
GRANT SELECT, INSERT ON document_citations TO authenticated;
GRANT SELECT, INSERT, UPDATE ON document_author_roles TO authenticated;
