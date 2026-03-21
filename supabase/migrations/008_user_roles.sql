-- ════════════════════════════════════════
-- PLEXUS Phase 8: User Roles
-- Fine-grained role definitions per institution
-- ════════════════════════════════════════

CREATE TABLE user_roles (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  institution_id  UUID REFERENCES institutions(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  slug            TEXT NOT NULL,
  description     TEXT,
  permissions     JSONB NOT NULL DEFAULT '[]',  -- Array of permission strings
  is_system_role  BOOLEAN DEFAULT false,        -- Built-in roles cannot be deleted
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE (institution_id, slug)
);

CREATE INDEX idx_user_roles_institution ON user_roles(institution_id) WHERE institution_id IS NOT NULL;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON user_roles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Junction table: assign roles to users (per institution)
CREATE TABLE user_role_assignments (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role_id         UUID NOT NULL REFERENCES user_roles(id) ON DELETE CASCADE,
  institution_id  UUID REFERENCES institutions(id) ON DELETE CASCADE,
  granted_by      UUID REFERENCES profiles(id),
  granted_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, role_id, institution_id)
);

CREATE INDEX idx_role_assignments_user ON user_role_assignments(user_id);
CREATE INDEX idx_role_assignments_role ON user_role_assignments(role_id);

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_role_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Roles visible to institution members" ON user_roles
  FOR SELECT TO authenticated USING (
    institution_id IS NULL OR
    institution_id IN (
      SELECT institution_id FROM institution_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Institution admins can manage roles" ON user_roles
  FOR ALL TO authenticated USING (
    institution_id IN (
      SELECT institution_id FROM institution_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

CREATE POLICY "Role assignments visible to institution members" ON user_role_assignments
  FOR SELECT TO authenticated USING (
    user_id = auth.uid() OR
    institution_id IN (
      SELECT institution_id FROM institution_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Institution admins can manage role assignments" ON user_role_assignments
  FOR ALL TO authenticated USING (
    institution_id IN (
      SELECT institution_id FROM institution_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

-- Seed system roles (global, no institution_id)
INSERT INTO user_roles (name, slug, description, permissions, is_system_role) VALUES
(
  'Researcher',
  'researcher',
  'Standard researcher with access to create projects and documents',
  '["project:create","document:create","document:read","review:request"]',
  true
),
(
  'Principal Investigator',
  'pi',
  'PI with full project management and member oversight',
  '["project:create","project:manage","document:create","document:read","document:approve","review:assign","member:invite"]',
  true
),
(
  'Coordinator',
  'coordinator',
  'Research coordinator managing reviews and compliance',
  '["project:read","document:read","document:approve","review:assign","ethics:manage"]',
  true
),
(
  'Admin',
  'admin',
  'Institution administrator with full platform access',
  '["project:create","project:manage","document:create","document:read","document:approve","review:assign","member:invite","member:manage","institution:manage","audit:read"]',
  true
);
