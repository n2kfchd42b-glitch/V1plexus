-- ════════════════════════════════════════
-- PLEXUS Phase 1 & 2 Schema
-- ════════════════════════════════════════

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Helper: update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ════════════════════════════════════════
-- PROFILES
-- ════════════════════════════════════════
CREATE TABLE profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         TEXT NOT NULL,
  full_name     TEXT,
  avatar_url    TEXT,
  role          TEXT DEFAULT 'researcher' CHECK (role IN ('researcher', 'supervisor', 'admin')),
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles are viewable by authenticated users" ON profiles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE TO authenticated USING (id = auth.uid());

CREATE TRIGGER set_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ════════════════════════════════════════
-- PROJECTS
-- ════════════════════════════════════════
CREATE TABLE projects (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title         TEXT NOT NULL,
  description   TEXT,
  status        TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed', 'archived')),
  owner_id      UUID NOT NULL REFERENCES profiles(id),
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project owners can manage their projects" ON projects
  FOR ALL TO authenticated USING (owner_id = auth.uid());

CREATE POLICY "Authenticated users can view all projects" ON projects
  FOR SELECT TO authenticated USING (true);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ════════════════════════════════════════
-- PROJECT MEMBERS
-- ════════════════════════════════════════
CREATE TABLE project_members (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id    UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES profiles(id),
  role          TEXT DEFAULT 'member' CHECK (role IN ('member', 'supervisor', 'admin')),
  joined_at     TIMESTAMPTZ DEFAULT now(),
  UNIQUE(project_id, user_id)
);

ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members viewable by project participants" ON project_members
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Project owner can manage members" ON project_members
  FOR ALL TO authenticated USING (
    project_id IN (SELECT id FROM projects WHERE owner_id = auth.uid())
  );

-- ════════════════════════════════════════
-- DOCUMENTS
-- ════════════════════════════════════════
CREATE TABLE documents (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title           TEXT NOT NULL DEFAULT 'Untitled Document',
  content         JSONB,
  content_text    TEXT,
  status          TEXT DEFAULT 'draft' CHECK (status IN (
                    'draft', 'in_review', 'revision_requested', 'approved'
                  )),
  document_type   TEXT DEFAULT 'general' CHECK (document_type IN (
                    'general', 'protocol', 'consent_form', 'ethics_application', 'report'
                  )),
  current_version INTEGER DEFAULT 1,
  created_by      UUID NOT NULL REFERENCES profiles(id),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Documents viewable by authenticated users" ON documents
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Document owner can manage document" ON documents
  FOR ALL TO authenticated USING (created_by = auth.uid());

CREATE TRIGGER set_updated_at BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ════════════════════════════════════════
-- DOCUMENT VERSIONS
-- ════════════════════════════════════════
CREATE TABLE document_versions (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id     UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  version_number  INTEGER NOT NULL,
  content         JSONB,
  content_text    TEXT,
  created_by      UUID NOT NULL REFERENCES profiles(id),
  change_summary  TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(document_id, version_number)
);

ALTER TABLE document_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Versions viewable by authenticated users" ON document_versions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can create versions" ON document_versions
  FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());

-- ════════════════════════════════════════
-- ETHICS APPLICATIONS
-- ════════════════════════════════════════
CREATE TABLE ethics_applications (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id        UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title             TEXT NOT NULL,
  description       TEXT,
  status            TEXT DEFAULT 'draft' CHECK (status IN (
                      'draft', 'submitted', 'under_review', 'approved',
                      'rejected', 'expired', 'amendment_required'
                    )),
  submitted_at      TIMESTAMPTZ,
  approved_at       TIMESTAMPTZ,
  expiry_date       DATE,
  protocol_number   TEXT,
  created_by        UUID NOT NULL REFERENCES profiles(id),
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE ethics_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ethics apps viewable by authenticated" ON ethics_applications
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Ethics app owner can manage" ON ethics_applications
  FOR ALL TO authenticated USING (created_by = auth.uid());

CREATE TRIGGER set_updated_at BEFORE UPDATE ON ethics_applications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
