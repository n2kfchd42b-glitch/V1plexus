-- ════════════════════════════════════════
-- WORKSPACE OVERHAUL MIGRATION
-- Run after backing up existing data
-- ════════════════════════════════════════

-- ════════════════════════════════════════
-- WORKSPACES
-- ════════════════════════════════════════
CREATE TABLE IF NOT EXISTS workspaces (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type            TEXT NOT NULL CHECK (type IN ('personal', 'institutional')),
  name            TEXT NOT NULL,
  slug            TEXT UNIQUE NOT NULL,
  owner_id        UUID REFERENCES profiles(id),
  institution_id  UUID REFERENCES institutions(id),
  avatar_url      TEXT,
  settings        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_workspace_personal ON workspaces(owner_id) WHERE type = 'personal';
CREATE UNIQUE INDEX IF NOT EXISTS idx_workspace_institution ON workspaces(institution_id) WHERE type = 'institutional';

-- ════════════════════════════════════════
-- WORKSPACE MEMBERSHIPS
-- ════════════════════════════════════════
CREATE TABLE IF NOT EXISTS workspace_memberships (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role            TEXT NOT NULL DEFAULT 'member' CHECK (role IN (
                    'owner', 'admin', 'department_head', 'supervisor', 'pi',
                    'researcher', 'student', 'collaborator', 'viewer'
                  )),
  department_id   UUID REFERENCES departments(id),
  supervisor_id   UUID REFERENCES profiles(id),
  joined_at       TIMESTAMPTZ DEFAULT now(),
  invited_by      UUID REFERENCES profiles(id),
  status          TEXT DEFAULT 'active' CHECK (status IN ('invited', 'active', 'suspended', 'left')),
  UNIQUE(workspace_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_ws_membership_user ON workspace_memberships(user_id, status);
CREATE INDEX IF NOT EXISTS idx_ws_membership_workspace ON workspace_memberships(workspace_id);
CREATE INDEX IF NOT EXISTS idx_ws_membership_supervisor ON workspace_memberships(supervisor_id) WHERE supervisor_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ws_membership_department ON workspace_memberships(department_id) WHERE department_id IS NOT NULL;

-- ════════════════════════════════════════
-- ADD workspace_id TO PROJECTS
-- ════════════════════════════════════════
ALTER TABLE projects ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id);
CREATE INDEX IF NOT EXISTS idx_projects_workspace ON projects(workspace_id);

-- ════════════════════════════════════════
-- WORKSPACE INVITATIONS
-- ════════════════════════════════════════
CREATE TABLE IF NOT EXISTS workspace_invitations (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  email           TEXT NOT NULL,
  role            TEXT NOT NULL,
  department_id   UUID REFERENCES departments(id),
  supervisor_id   UUID REFERENCES profiles(id),
  message         TEXT,
  token           TEXT UNIQUE NOT NULL,
  invited_by      UUID NOT NULL REFERENCES profiles(id),
  status          TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  expires_at      TIMESTAMPTZ DEFAULT (now() + interval '30 days'),
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ws_invitations_email ON workspace_invitations(email, status);
CREATE INDEX IF NOT EXISTS idx_ws_invitations_token ON workspace_invitations(token);

-- ════════════════════════════════════════
-- PROJECT INVITATIONS
-- ════════════════════════════════════════
CREATE TABLE IF NOT EXISTS project_invitations (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  email           TEXT NOT NULL,
  role            TEXT NOT NULL DEFAULT 'collaborator' CHECK (role IN (
                    'co_pi', 'researcher', 'collaborator', 'reviewer', 'viewer'
                  )),
  message         TEXT,
  token           TEXT UNIQUE NOT NULL,
  invited_by      UUID NOT NULL REFERENCES profiles(id),
  status          TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  expires_at      TIMESTAMPTZ DEFAULT (now() + interval '30 days'),
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_proj_invitations_email ON project_invitations(email, status);
CREATE INDEX IF NOT EXISTS idx_proj_invitations_token ON project_invitations(token);

-- ════════════════════════════════════════
-- SUPERVISOR ASSIGNMENTS
-- ════════════════════════════════════════
CREATE TABLE IF NOT EXISTS supervisor_assignments (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  department_id   UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  supervisor_id   UUID NOT NULL REFERENCES profiles(id),
  student_id      UUID NOT NULL REFERENCES profiles(id),
  assigned_by     UUID REFERENCES profiles(id),
  status          TEXT DEFAULT 'active' CHECK (status IN ('active', 'ended', 'transferred')),
  assigned_at     TIMESTAMPTZ DEFAULT now(),
  ended_at        TIMESTAMPTZ,
  UNIQUE(workspace_id, supervisor_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_supervisor_assignments_supervisor ON supervisor_assignments(supervisor_id, status);
CREATE INDEX IF NOT EXISTS idx_supervisor_assignments_student ON supervisor_assignments(student_id, status);

-- ════════════════════════════════════════
-- ADD workspace_setup_completed TO PROFILES
-- ════════════════════════════════════════
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS workspace_setup_completed BOOLEAN DEFAULT FALSE;

-- ════════════════════════════════════════
-- RLS POLICIES
-- ════════════════════════════════════════
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE supervisor_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see their workspaces" ON workspaces;
CREATE POLICY "Users see their workspaces" ON workspaces
  FOR SELECT TO authenticated USING (
    id IN (SELECT workspace_id FROM workspace_memberships WHERE user_id = auth.uid() AND status = 'active')
  );

DROP POLICY IF EXISTS "Users can insert their own workspace" ON workspaces;
CREATE POLICY "Users can insert their own workspace" ON workspaces
  FOR INSERT TO authenticated WITH CHECK (
    owner_id = auth.uid() OR
    auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin')
  );

DROP POLICY IF EXISTS "Members see workspace memberships" ON workspace_memberships;
CREATE POLICY "Members see workspace memberships" ON workspace_memberships
  FOR SELECT TO authenticated USING (
    workspace_id IN (SELECT workspace_id FROM workspace_memberships WHERE user_id = auth.uid() AND status = 'active')
  );

DROP POLICY IF EXISTS "Users can insert their own membership" ON workspace_memberships;
CREATE POLICY "Users can insert their own membership" ON workspace_memberships
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Inviters see invitations" ON workspace_invitations;
CREATE POLICY "Inviters see invitations" ON workspace_invitations
  FOR SELECT TO authenticated USING (invited_by = auth.uid());

DROP POLICY IF EXISTS "Anyone can read workspace invitations by token" ON workspace_invitations;
CREATE POLICY "Anyone can read workspace invitations by token" ON workspace_invitations
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Project members see invitations" ON project_invitations;
CREATE POLICY "Project members see invitations" ON project_invitations
  FOR SELECT TO authenticated USING (
    project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Project owners can insert project invitations" ON project_invitations;
CREATE POLICY "Project owners can insert project invitations" ON project_invitations
  FOR INSERT TO authenticated WITH CHECK (invited_by = auth.uid());

DROP POLICY IF EXISTS "Supervisors see their assignments" ON supervisor_assignments;
CREATE POLICY "Supervisors see their assignments" ON supervisor_assignments
  FOR SELECT TO authenticated USING (
    supervisor_id = auth.uid() OR student_id = auth.uid() OR
    workspace_id IN (
      SELECT workspace_id FROM workspace_memberships
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'department_head') AND status = 'active'
    )
  );

-- Update projects RLS
DROP POLICY IF EXISTS "Projects visible to members" ON projects;
DROP POLICY IF EXISTS "Projects visible through workspace" ON projects;
CREATE POLICY "Projects visible through workspace" ON projects
  FOR SELECT TO authenticated USING (
    id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid())
    OR owner_id = auth.uid()
    OR workspace_id IN (
      SELECT workspace_id FROM workspace_memberships
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin') AND status = 'active'
    )
    OR (department_id IS NOT NULL AND department_id IN (
      SELECT department_id FROM workspace_memberships
      WHERE user_id = auth.uid() AND role = 'department_head' AND status = 'active'
    ))
    OR owner_id IN (
      SELECT student_id FROM supervisor_assignments
      WHERE supervisor_id = auth.uid() AND status = 'active'
    )
  );

-- ════════════════════════════════════════
-- TRIGGERS
-- ════════════════════════════════════════
DROP TRIGGER IF EXISTS set_updated_at ON workspaces;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON workspaces
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ════════════════════════════════════════
-- DATA MIGRATION (for existing data)
-- Run after the schema changes above
-- ════════════════════════════════════════

-- 1. Create personal workspaces for all existing profiles
INSERT INTO workspaces (type, name, slug, owner_id)
SELECT
  'personal',
  COALESCE(full_name, email) || '''s Workspace',
  'personal-' || id::text,
  id
FROM profiles
WHERE NOT EXISTS (
  SELECT 1 FROM workspaces WHERE owner_id = profiles.id AND type = 'personal'
);

-- 2. Create workspace_memberships for personal workspaces
INSERT INTO workspace_memberships (workspace_id, user_id, role, status)
SELECT w.id, w.owner_id, 'owner', 'active'
FROM workspaces w
WHERE w.type = 'personal'
AND NOT EXISTS (
  SELECT 1 FROM workspace_memberships wm
  WHERE wm.workspace_id = w.id AND wm.user_id = w.owner_id
);

-- 3. Create institutional workspaces for existing institutions
INSERT INTO workspaces (type, name, slug, institution_id)
SELECT
  'institutional',
  i.name,
  COALESCE(i.website, 'institution-' || i.id::text),
  i.id
FROM institutions i
WHERE NOT EXISTS (
  SELECT 1 FROM workspaces WHERE institution_id = i.id AND type = 'institutional'
);

-- 4. Assign workspace_id to existing projects (personal workspace of owner)
UPDATE projects p
SET workspace_id = (
  SELECT w.id FROM workspaces w
  WHERE w.owner_id = p.owner_id AND w.type = 'personal'
  LIMIT 1
)
WHERE p.workspace_id IS NULL;

-- Mark all existing users as having completed workspace setup (legacy)
UPDATE profiles SET workspace_setup_completed = TRUE
WHERE workspace_setup_completed IS FALSE OR workspace_setup_completed IS NULL;
