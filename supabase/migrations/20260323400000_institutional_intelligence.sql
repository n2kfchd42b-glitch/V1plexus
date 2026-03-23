-- ════════════════════════════════════════════════════════════════
-- Phase 11: Institutional Intelligence
-- Research Impact Dashboard, Grant Management, Knowledge Base
-- ════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════
-- GRANTS
-- ════════════════════════════════════════
CREATE TABLE grants (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  institution_id    UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  title             TEXT NOT NULL,
  funder_name       TEXT NOT NULL,
  funder_type       TEXT CHECK (funder_type IN (
                      'bilateral', 'multilateral', 'foundation', 'government', 'private', 'university', 'other'
                    )),
  grant_number      TEXT,
  amount            DECIMAL(15,2),
  currency          TEXT DEFAULT 'USD',
  start_date        DATE,
  end_date          DATE,
  status            TEXT DEFAULT 'active' CHECK (status IN (
                      'applied', 'active', 'completed', 'closed', 'rejected'
                    )),
  reporting_schedule JSONB DEFAULT '[]',
  pi_id             UUID REFERENCES profiles(id),
  notes             TEXT,
  created_by        UUID REFERENCES profiles(id),
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE grant_projects (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  grant_id        UUID NOT NULL REFERENCES grants(id) ON DELETE CASCADE,
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  budget_allocated DECIMAL(15,2),
  UNIQUE(grant_id, project_id)
);

CREATE TABLE grant_reports (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  grant_id        UUID NOT NULL REFERENCES grants(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  report_type     TEXT DEFAULT 'progress' CHECK (report_type IN (
                    'progress', 'annual', 'final', 'financial', 'custom'
                  )),
  due_date        DATE,
  submitted_at    TIMESTAMPTZ,
  document_id     UUID REFERENCES documents(id),
  status          TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'draft', 'submitted', 'accepted')),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);


-- ════════════════════════════════════════
-- KNOWLEDGE BASE
-- ════════════════════════════════════════
CREATE TABLE knowledge_base_entries (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  institution_id  UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  project_id      UUID REFERENCES projects(id),
  resource_type   TEXT NOT NULL CHECK (resource_type IN (
                    'protocol', 'manuscript', 'dataset', 'analysis_config',
                    'thesis', 'template', 'sop', 'report'
                  )),
  resource_id     UUID NOT NULL,
  title           TEXT NOT NULL,
  description     TEXT,
  keywords        TEXT[] DEFAULT '{}',
  disease_area    TEXT[] DEFAULT '{}',
  methodology     TEXT[] DEFAULT '{}',
  geographic_scope TEXT[] DEFAULT '{}',
  authors         JSONB DEFAULT '[]',
  search_vector   TSVECTOR,
  is_template     BOOLEAN DEFAULT false,
  archived_at     TIMESTAMPTZ DEFAULT now(),
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_kb_institution ON knowledge_base_entries(institution_id);
CREATE INDEX idx_kb_search ON knowledge_base_entries USING gin(search_vector);
CREATE INDEX idx_kb_keywords ON knowledge_base_entries USING gin(keywords);
CREATE INDEX idx_kb_disease ON knowledge_base_entries USING gin(disease_area);

-- Auto-generate search vector
CREATE OR REPLACE FUNCTION kb_search_vector_update()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('english',
    coalesce(NEW.title, '') || ' ' ||
    coalesce(NEW.description, '') || ' ' ||
    coalesce(array_to_string(NEW.keywords, ' '), '') || ' ' ||
    coalesce(array_to_string(NEW.disease_area, ' '), '') || ' ' ||
    coalesce(array_to_string(NEW.methodology, ' '), '') || ' ' ||
    coalesce(array_to_string(NEW.geographic_scope, ' '), '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER kb_search_update BEFORE INSERT OR UPDATE ON knowledge_base_entries
  FOR EACH ROW EXECUTE FUNCTION kb_search_vector_update();


-- ════════════════════════════════════════
-- RESEARCH METRICS (pre-computed, updated nightly)
-- ════════════════════════════════════════
CREATE TABLE research_metrics (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  institution_id  UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  department_id   UUID REFERENCES departments(id),
  period          TEXT NOT NULL,
  metrics         JSONB NOT NULL,
  computed_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_metrics_inst ON research_metrics(institution_id, period);


-- ════════════════════════════════════════
-- TIMESTAMPS
-- ════════════════════════════════════════
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Only create triggers if they don't already exist (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'grants_updated_at'
  ) THEN
    CREATE TRIGGER grants_updated_at
      BEFORE UPDATE ON grants
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'grant_reports_updated_at'
  ) THEN
    CREATE TRIGGER grant_reports_updated_at
      BEFORE UPDATE ON grant_reports
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END;
$$;


-- ════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ════════════════════════════════════════
ALTER TABLE grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE grant_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE grant_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_base_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE research_metrics ENABLE ROW LEVEL SECURITY;

-- Grants: visible to institution members, writable by admin/pi/coordinator
CREATE POLICY "Grants visible to institution members" ON grants
  FOR SELECT TO authenticated USING (
    institution_id IN (SELECT institution_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Grants manageable by admin or pi" ON grants
  FOR ALL TO authenticated USING (
    institution_id IN (SELECT institution_id FROM profiles WHERE id = auth.uid())
    AND (
      (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'pi', 'coordinator')
    )
  );

-- Grant projects join
CREATE POLICY "Grant projects visible to institution members" ON grant_projects
  FOR SELECT TO authenticated USING (
    grant_id IN (
      SELECT id FROM grants
      WHERE institution_id IN (SELECT institution_id FROM profiles WHERE id = auth.uid())
    )
  );

CREATE POLICY "Grant projects manageable by admin or pi" ON grant_projects
  FOR ALL TO authenticated USING (
    grant_id IN (
      SELECT id FROM grants
      WHERE institution_id IN (SELECT institution_id FROM profiles WHERE id = auth.uid())
    )
    AND (
      (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'pi', 'coordinator')
    )
  );

-- Grant reports
CREATE POLICY "Grant reports visible to institution members" ON grant_reports
  FOR SELECT TO authenticated USING (
    grant_id IN (
      SELECT id FROM grants
      WHERE institution_id IN (SELECT institution_id FROM profiles WHERE id = auth.uid())
    )
  );

CREATE POLICY "Grant reports manageable by admin or pi" ON grant_reports
  FOR ALL TO authenticated USING (
    grant_id IN (
      SELECT id FROM grants
      WHERE institution_id IN (SELECT institution_id FROM profiles WHERE id = auth.uid())
    )
    AND (
      (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'pi', 'coordinator')
    )
  );

-- Knowledge base
CREATE POLICY "KB visible to institution members" ON knowledge_base_entries
  FOR SELECT TO authenticated USING (
    institution_id IN (SELECT institution_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "KB manageable by admin or pi" ON knowledge_base_entries
  FOR ALL TO authenticated USING (
    institution_id IN (SELECT institution_id FROM profiles WHERE id = auth.uid())
    AND (
      (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'pi', 'coordinator')
    )
  );

-- Research metrics
CREATE POLICY "Metrics visible to institution members" ON research_metrics
  FOR SELECT TO authenticated USING (
    institution_id IN (SELECT institution_id FROM profiles WHERE id = auth.uid())
  );
