-- ════════════════════════════════════════
-- PLEXUS Research Lab — Phase 1 Schema
-- ════════════════════════════════════════

-- ════════════════════════════════════════
-- UPDATED_AT TRIGGER FUNCTION
-- ════════════════════════════════════════
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ════════════════════════════════════════
-- PROFILES (extends Supabase auth.users)
-- ════════════════════════════════════════
CREATE TABLE profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  full_name   TEXT NOT NULL,
  avatar_url  TEXT,
  institution_id UUID,  -- set after institution assignment (FK added below)
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();


-- ════════════════════════════════════════
-- INSTITUTIONS
-- ════════════════════════════════════════
CREATE TABLE institutions (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name        TEXT NOT NULL,
  slug        TEXT UNIQUE NOT NULL,
  logo_url    TEXT,
  settings    JSONB DEFAULT '{}',
  created_by  UUID REFERENCES profiles(id),
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now(),
  deleted_at  TIMESTAMPTZ
);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON institutions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Add FK from profiles to institutions (after both exist)
ALTER TABLE profiles
  ADD CONSTRAINT fk_profiles_institution
  FOREIGN KEY (institution_id) REFERENCES institutions(id);


-- ════════════════════════════════════════
-- DEPARTMENTS
-- ════════════════════════════════════════
CREATE TABLE departments (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  institution_id  UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  slug            TEXT NOT NULL,
  description     TEXT,
  settings        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  deleted_at      TIMESTAMPTZ,
  UNIQUE(institution_id, slug)
);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON departments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ════════════════════════════════════════
-- PROJECTS (defined before user_roles for FK)
-- ════════════════════════════════════════
CREATE TABLE projects (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title           TEXT NOT NULL,
  description     TEXT,
  department_id   UUID REFERENCES departments(id),  -- NULL for individual projects
  owner_id        UUID NOT NULL REFERENCES profiles(id),
  status          TEXT DEFAULT 'active' CHECK (status IN (
                    'active', 'paused', 'completed', 'archived'
                  )),
  phase           TEXT DEFAULT 'concept' CHECK (phase IN (
                    'concept', 'protocol', 'ethics_review',
                    'data_collection', 'analysis', 'writing', 'publication', 'archived'
                  )),
  start_date      DATE,
  target_end_date DATE,
  settings        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_projects_owner ON projects(owner_id);
CREATE INDEX idx_projects_department ON projects(department_id) WHERE department_id IS NOT NULL;
CREATE INDEX idx_projects_status ON projects(status);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ════════════════════════════════════════
-- USER ROLES (multi-level scope)
-- ════════════════════════════════════════
CREATE TABLE user_roles (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK (role IN (
                    'institution_admin',
                    'department_head',
                    'principal_investigator',
                    'supervisor',
                    'researcher',
                    'external_reviewer'
                  )),
  -- Scope: at most one of these is non-null to define where the role applies
  institution_id  UUID REFERENCES institutions(id) ON DELETE CASCADE,
  department_id   UUID REFERENCES departments(id) ON DELETE CASCADE,
  project_id      UUID REFERENCES projects(id) ON DELETE CASCADE,
  granted_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ DEFAULT now(),
  expires_at      TIMESTAMPTZ
);

CREATE INDEX idx_user_roles_user ON user_roles(user_id);
CREATE INDEX idx_user_roles_institution ON user_roles(institution_id);
CREATE INDEX idx_user_roles_department ON user_roles(department_id);
CREATE INDEX idx_user_roles_project ON user_roles(project_id);


-- ════════════════════════════════════════
-- PROJECT MEMBERS
-- ════════════════════════════════════════
CREATE TABLE project_members (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN (
                'pi', 'supervisor', 'researcher', 'collaborator', 'viewer'
              )),
  joined_at   TIMESTAMPTZ DEFAULT now(),
  invited_by  UUID REFERENCES profiles(id),
  UNIQUE(project_id, user_id)
);

CREATE INDEX idx_project_members_user ON project_members(user_id);
CREATE INDEX idx_project_members_project ON project_members(project_id);


-- ════════════════════════════════════════
-- PROJECT MILESTONES
-- ════════════════════════════════════════
CREATE TABLE project_milestones (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id        UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title             TEXT NOT NULL,
  description       TEXT,
  due_date          DATE,
  completed_at      TIMESTAMPTZ,
  status            TEXT DEFAULT 'pending' CHECK (status IN (
                      'pending', 'in_progress', 'completed', 'overdue'
                    )),
  sort_order        INTEGER DEFAULT 0,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_milestones_project ON project_milestones(project_id);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON project_milestones
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ════════════════════════════════════════

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE institutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_milestones ENABLE ROW LEVEL SECURITY;

-- PROFILES: users can read all profiles, update only their own
CREATE POLICY "Profiles are viewable by authenticated users"
  ON profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE TO authenticated USING (id = auth.uid());
CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

-- INSTITUTIONS: members can read their institution
CREATE POLICY "Institution members can read"
  ON institutions FOR SELECT TO authenticated
  USING (
    id IN (SELECT institution_id FROM profiles WHERE id = auth.uid() AND institution_id IS NOT NULL)
  );
CREATE POLICY "Institution admins can update"
  ON institutions FOR UPDATE TO authenticated
  USING (id IN (
    SELECT institution_id FROM user_roles
    WHERE user_id = auth.uid() AND role = 'institution_admin'
  ));
CREATE POLICY "Authenticated users can create institutions"
  ON institutions FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

-- DEPARTMENTS: visible to institution members
CREATE POLICY "Departments visible to institution members"
  ON departments FOR SELECT TO authenticated
  USING (institution_id IN (
    SELECT institution_id FROM profiles WHERE id = auth.uid() AND institution_id IS NOT NULL
  ));
CREATE POLICY "Institution admins can manage departments"
  ON departments FOR ALL TO authenticated
  USING (institution_id IN (
    SELECT institution_id FROM user_roles
    WHERE user_id = auth.uid() AND role = 'institution_admin'
  ));

-- USER ROLES: users can read their own roles
CREATE POLICY "Users can read their own roles"
  ON user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "Institution admins can manage roles"
  ON user_roles FOR ALL TO authenticated
  USING (
    institution_id IN (
      SELECT institution_id FROM user_roles
      WHERE user_id = auth.uid() AND role = 'institution_admin'
    )
  );

-- PROJECTS: visible to members + department/institution staff
CREATE POLICY "Projects visible to members"
  ON projects FOR SELECT TO authenticated
  USING (
    owner_id = auth.uid()
    OR id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid())
    OR department_id IN (
      SELECT department_id FROM user_roles
      WHERE user_id = auth.uid() AND department_id IS NOT NULL
    )
  );
CREATE POLICY "Project owners can update"
  ON projects FOR UPDATE TO authenticated
  USING (owner_id = auth.uid());
CREATE POLICY "Authenticated users can create projects"
  ON projects FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Project owners can delete"
  ON projects FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

-- PROJECT MEMBERS: visible to project members
CREATE POLICY "Project members visible to members"
  ON project_members FOR SELECT TO authenticated
  USING (project_id IN (
    SELECT project_id FROM project_members WHERE user_id = auth.uid()
    UNION
    SELECT id FROM projects WHERE owner_id = auth.uid()
  ));
CREATE POLICY "Project owners can manage members"
  ON project_members FOR ALL TO authenticated
  USING (project_id IN (
    SELECT id FROM projects WHERE owner_id = auth.uid()
  ));

-- MILESTONES: follow project visibility
CREATE POLICY "Milestones follow project access"
  ON project_milestones FOR SELECT TO authenticated
  USING (project_id IN (
    SELECT project_id FROM project_members WHERE user_id = auth.uid()
    UNION
    SELECT id FROM projects WHERE owner_id = auth.uid()
  ));
CREATE POLICY "Project members can manage milestones"
  ON project_milestones FOR ALL TO authenticated
  USING (project_id IN (
    SELECT id FROM projects WHERE owner_id = auth.uid()
  ));
