-- ============================================================
-- Phase 8: Thesis & Student Management
-- ============================================================

-- Extend projects with thesis-specific metadata
CREATE TABLE IF NOT EXISTS thesis_metadata (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id        UUID UNIQUE NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  degree_type       TEXT NOT NULL CHECK (degree_type IN (
                      'msc', 'mphil', 'phd', 'drph', 'md', 'other'
                    )),
  program_name      TEXT NOT NULL,
  enrollment_date   DATE,
  expected_completion DATE,
  actual_completion DATE,
  thesis_title      TEXT,
  defense_status    TEXT DEFAULT 'not_scheduled' CHECK (defense_status IN (
                      'not_scheduled', 'proposal_scheduled', 'proposal_completed',
                      'final_scheduled', 'final_completed', 'passed', 'passed_with_corrections',
                      'revise_resubmit', 'failed'
                    )),
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS thesis_committees (
  id                   UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id           UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id              UUID REFERENCES profiles(id),
  external_name        TEXT,
  external_email       TEXT,
  external_institution TEXT,
  role                 TEXT NOT NULL CHECK (role IN (
                         'chair', 'co_chair', 'member', 'external_examiner', 'advisor'
                       )),
  status               TEXT DEFAULT 'invited' CHECK (status IN (
                         'invited', 'confirmed', 'declined', 'removed'
                       )),
  invited_at           TIMESTAMPTZ DEFAULT now(),
  confirmed_at         TIMESTAMPTZ,
  invited_by           UUID REFERENCES profiles(id),
  created_at           TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS thesis_chapters (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id     UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  document_id    UUID REFERENCES documents(id),
  chapter_number INTEGER NOT NULL,
  title          TEXT NOT NULL,
  status         TEXT DEFAULT 'not_started' CHECK (status IN (
                   'not_started', 'drafting', 'submitted_for_review',
                   'revision_requested', 'approved', 'locked'
                 )),
  target_date    DATE,
  submitted_at   TIMESTAMPTZ,
  approved_at    TIMESTAMPTZ,
  approved_by    UUID REFERENCES profiles(id),
  sort_order     INTEGER,
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS thesis_defenses (
  id                        UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id                UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  defense_type              TEXT NOT NULL CHECK (defense_type IN ('proposal', 'final')),
  scheduled_date            DATE,
  scheduled_time            TIME,
  location                  TEXT,
  meeting_link              TEXT,
  outcome                   TEXT CHECK (outcome IN (
                               'pass', 'pass_with_corrections', 'revise_resubmit', 'fail'
                             )),
  corrections_deadline      DATE,
  corrections_completed_at  TIMESTAMPTZ,
  examiner_reports          JSONB DEFAULT '[]',
  notes                     TEXT,
  created_at                TIMESTAMPTZ DEFAULT now(),
  updated_at                TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS format_rules (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  rules          JSONB NOT NULL DEFAULT '{}',
  is_active      BOOLEAN DEFAULT true,
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS guest_access_tokens (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  committee_id UUID NOT NULL REFERENCES thesis_committees(id) ON DELETE CASCADE,
  token        TEXT UNIQUE NOT NULL DEFAULT replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  email        TEXT NOT NULL,
  permissions  JSONB DEFAULT '["document.read", "document.comment"]',
  expires_at   TIMESTAMPTZ NOT NULL,
  last_used_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_thesis_meta_project    ON thesis_metadata(project_id);
CREATE INDEX IF NOT EXISTS idx_thesis_committees_proj ON thesis_committees(project_id);
CREATE INDEX IF NOT EXISTS idx_thesis_chapters_proj   ON thesis_chapters(project_id);
CREATE INDEX IF NOT EXISTS idx_thesis_defenses_proj   ON thesis_defenses(project_id);
CREATE INDEX IF NOT EXISTS idx_guest_tokens           ON guest_access_tokens(token);

-- Row-Level Security
ALTER TABLE thesis_metadata     ENABLE ROW LEVEL SECURITY;
ALTER TABLE thesis_committees   ENABLE ROW LEVEL SECURITY;
ALTER TABLE thesis_chapters     ENABLE ROW LEVEL SECURITY;
ALTER TABLE thesis_defenses     ENABLE ROW LEVEL SECURITY;
ALTER TABLE format_rules        ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest_access_tokens ENABLE ROW LEVEL SECURITY;

-- Thesis data follows project visibility
CREATE POLICY "Thesis metadata visible to project members"
  ON thesis_metadata FOR SELECT TO authenticated
  USING (
    project_id IN (
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
      UNION SELECT id FROM projects WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Thesis metadata writable by project members"
  ON thesis_metadata FOR ALL TO authenticated
  USING (
    project_id IN (
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
      UNION SELECT id FROM projects WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Thesis committees visible to project members"
  ON thesis_committees FOR SELECT TO authenticated
  USING (
    project_id IN (
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
      UNION SELECT id FROM projects WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Thesis committees writable by project members"
  ON thesis_committees FOR ALL TO authenticated
  USING (
    project_id IN (
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
      UNION SELECT id FROM projects WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Thesis chapters visible to project members"
  ON thesis_chapters FOR SELECT TO authenticated
  USING (
    project_id IN (
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
      UNION SELECT id FROM projects WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Thesis chapters writable by project members"
  ON thesis_chapters FOR ALL TO authenticated
  USING (
    project_id IN (
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
      UNION SELECT id FROM projects WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Thesis defenses visible to project members"
  ON thesis_defenses FOR SELECT TO authenticated
  USING (
    project_id IN (
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
      UNION SELECT id FROM projects WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Thesis defenses writable by project members"
  ON thesis_defenses FOR ALL TO authenticated
  USING (
    project_id IN (
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
      UNION SELECT id FROM projects WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Format rules visible to institution members"
  ON format_rules FOR SELECT TO authenticated
  USING (
    institution_id IN (
      SELECT institution_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Format rules writable by admins"
  ON format_rules FOR ALL TO authenticated
  USING (
    institution_id IN (
      SELECT institution_id FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Guest tokens visible to committee project members"
  ON guest_access_tokens FOR SELECT TO authenticated
  USING (
    committee_id IN (
      SELECT id FROM thesis_committees tc
      WHERE tc.project_id IN (
        SELECT project_id FROM project_members WHERE user_id = auth.uid()
        UNION SELECT id FROM projects WHERE owner_id = auth.uid()
      )
    )
  );

CREATE POLICY "Guest tokens writable by project members"
  ON guest_access_tokens FOR ALL TO authenticated
  USING (
    committee_id IN (
      SELECT id FROM thesis_committees tc
      WHERE tc.project_id IN (
        SELECT project_id FROM project_members WHERE user_id = auth.uid()
        UNION SELECT id FROM projects WHERE owner_id = auth.uid()
      )
    )
  );

-- Auto-update updated_at triggers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_thesis_metadata'
  ) THEN
    CREATE TRIGGER set_updated_at_thesis_metadata
      BEFORE UPDATE ON thesis_metadata
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_thesis_chapters'
  ) THEN
    CREATE TRIGGER set_updated_at_thesis_chapters
      BEFORE UPDATE ON thesis_chapters
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_thesis_defenses'
  ) THEN
    CREATE TRIGGER set_updated_at_thesis_defenses
      BEFORE UPDATE ON thesis_defenses
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END $$;
