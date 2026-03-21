-- ════════════════════════════════════════
-- PLEXUS Phase 1 — Initial Schema
-- ════════════════════════════════════════

-- Helper: updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ════════════════════════════════════════
-- INSTITUTIONS & DEPARTMENTS
-- ════════════════════════════════════════
CREATE TABLE institutions (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name        TEXT NOT NULL,
  country     TEXT,
  city        TEXT,
  website     TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE departments (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  created_at     TIMESTAMPTZ DEFAULT now()
);

-- ════════════════════════════════════════
-- PROFILES (extends auth.users)
-- ════════════════════════════════════════
CREATE TABLE profiles (
  id             UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name      TEXT,
  email          TEXT,
  institution_id UUID REFERENCES institutions(id),
  department_id  UUID REFERENCES departments(id),
  role           TEXT DEFAULT 'researcher' CHECK (role IN (
                   'researcher', 'pi', 'coordinator', 'admin'
                 )),
  avatar_url     TEXT,
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON institutions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
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
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title          TEXT NOT NULL,
  description    TEXT,
  owner_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  institution_id UUID REFERENCES institutions(id),
  status         TEXT DEFAULT 'active' CHECK (status IN (
                   'active', 'on_hold', 'completed', 'archived'
                 )),
  start_date     DATE,
  end_date       DATE,
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now(),
  deleted_at     TIMESTAMPTZ
);

CREATE INDEX idx_projects_owner ON projects(owner_id);
CREATE INDEX idx_projects_institution ON projects(institution_id);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ════════════════════════════════════════
-- PROJECT MEMBERS
-- ════════════════════════════════════════
CREATE TABLE project_members (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role       TEXT DEFAULT 'member' CHECK (role IN ('owner', 'pi', 'member', 'viewer')),
  joined_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (project_id, user_id)
);

CREATE INDEX idx_project_members_project ON project_members(project_id);
CREATE INDEX idx_project_members_user ON project_members(user_id);

-- ════════════════════════════════════════
-- RLS POLICIES
-- ════════════════════════════════════════
ALTER TABLE institutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;

-- Institutions: public read
CREATE POLICY "Institutions are publicly visible" ON institutions
  FOR SELECT USING (true);

-- Departments: public read
CREATE POLICY "Departments are publicly visible" ON departments
  FOR SELECT USING (true);

-- Profiles: own profile full access, others read-only
CREATE POLICY "Users can view all profiles" ON profiles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Projects: owners and members can see
CREATE POLICY "Projects visible to owner and members" ON projects
  FOR SELECT TO authenticated USING (
    owner_id = auth.uid()
    OR id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid())
  );
CREATE POLICY "Authenticated users can create projects" ON projects
  FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Owners can update their projects" ON projects
  FOR UPDATE TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "Owners can delete their projects" ON projects
  FOR DELETE TO authenticated USING (owner_id = auth.uid());

-- Project members
CREATE POLICY "Project members visible to project members" ON project_members
  FOR SELECT TO authenticated USING (
    project_id IN (
      SELECT id FROM projects WHERE owner_id = auth.uid()
      UNION SELECT project_id FROM project_members WHERE user_id = auth.uid()
    )
  );
CREATE POLICY "Project owners can manage members" ON project_members
  FOR ALL TO authenticated USING (
    project_id IN (SELECT id FROM projects WHERE owner_id = auth.uid())
  );

-- ════════════════════════════════════════
-- SEED DATA
-- ════════════════════════════════════════
INSERT INTO institutions (name, country, city) VALUES
  ('University of Ghana', 'Ghana', 'Accra'),
  ('Kwame Nkrumah University of Science and Technology', 'Ghana', 'Kumasi'),
  ('University of Nairobi', 'Kenya', 'Nairobi'),
  ('University of Cape Town', 'South Africa', 'Cape Town'),
  ('Makerere University', 'Uganda', 'Kampala');
