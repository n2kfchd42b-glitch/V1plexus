-- ============================================================
-- Phase 12: Research Network & Global Compliance
-- ============================================================

-- ════════════════════════════════════════
-- RESEARCH NETWORK
-- ════════════════════════════════════════
CREATE TABLE network_datasets (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  dataset_id      UUID NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
  version_id      UUID NOT NULL REFERENCES dataset_versions(id),
  institution_id  UUID NOT NULL REFERENCES institutions(id),
  visibility      TEXT DEFAULT 'metadata_only' CHECK (visibility IN (
                    'metadata_only', 'request_access', 'open'
                  )),
  title           TEXT NOT NULL,
  description     TEXT,
  authors         JSONB NOT NULL DEFAULT '[]',
  license         TEXT DEFAULT 'CC-BY-4.0' CHECK (license IN (
                    'CC-BY-4.0', 'CC-BY-SA-4.0', 'CC-BY-NC-4.0', 'CC0', 'custom'
                  )),
  keywords        TEXT[] DEFAULT '{}',
  disease_area    TEXT[] DEFAULT '{}',
  geographic_scope TEXT[] DEFAULT '{}',
  methodology     TEXT[] DEFAULT '{}',
  date_range      DATERANGE,
  sample_size     INTEGER,
  embargo_until   DATE,
  citation_count  INTEGER DEFAULT 0,
  view_count      INTEGER DEFAULT 0,
  access_count    INTEGER DEFAULT 0,
  published_at    TIMESTAMPTZ DEFAULT now(),
  published_by    UUID REFERENCES profiles(id),
  search_vector   TSVECTOR,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_network_search ON network_datasets USING gin(search_vector);
CREATE INDEX idx_network_disease ON network_datasets USING gin(disease_area);
CREATE INDEX idx_network_geo ON network_datasets USING gin(geographic_scope);
CREATE INDEX idx_network_keywords ON network_datasets USING gin(keywords);
CREATE INDEX idx_network_institution ON network_datasets(institution_id);

-- Auto-generate search vector
CREATE TRIGGER network_search_update BEFORE INSERT OR UPDATE ON network_datasets
  FOR EACH ROW EXECUTE FUNCTION kb_search_vector_update();

CREATE TABLE dataset_access_requests (
  id                    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  network_dataset_id    UUID NOT NULL REFERENCES network_datasets(id) ON DELETE CASCADE,
  requester_id          UUID NOT NULL REFERENCES profiles(id),
  requester_institution UUID REFERENCES institutions(id),
  purpose               TEXT NOT NULL,
  intended_use          TEXT,
  data_sharing_agreement BOOLEAN DEFAULT false,
  status                TEXT DEFAULT 'pending' CHECK (status IN (
                          'pending', 'approved', 'denied', 'withdrawn', 'expired'
                        )),
  reviewed_by           UUID REFERENCES profiles(id),
  reviewed_at           TIMESTAMPTZ,
  review_notes          TEXT,
  access_expires        DATE,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);

-- Cross-institutional project membership
CREATE TABLE cross_institution_invites (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  inviter_id          UUID NOT NULL REFERENCES profiles(id),
  invitee_email       TEXT NOT NULL,
  invitee_institution TEXT,
  role                TEXT DEFAULT 'collaborator',
  status              TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  token               TEXT UNIQUE NOT NULL,
  expires_at          TIMESTAMPTZ NOT NULL,
  created_at          TIMESTAMPTZ DEFAULT now()
);


-- ════════════════════════════════════════
-- COMPLIANCE ENGINE
-- ════════════════════════════════════════
CREATE TABLE compliance_profiles (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  framework      TEXT NOT NULL CHECK (framework IN (
                   'gdpr', 'ghana_dpa', 'kenya_dpa', 'hipaa',
                   'south_africa_popia', 'nigeria_ndpr', 'custom'
                 )),
  rules          JSONB NOT NULL,
  is_active      BOOLEAN DEFAULT true,
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE compliance_checks (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id  UUID NOT NULL REFERENCES compliance_profiles(id),
  project_id  UUID NOT NULL REFERENCES projects(id),
  dataset_id  UUID REFERENCES datasets(id),
  check_type  TEXT NOT NULL CHECK (check_type IN (
                'pii_detection', 'consent_verification', 'retention_check',
                'access_audit', 'cross_border_check', 'anonymization_check'
              )),
  status      TEXT DEFAULT 'pending' CHECK (status IN ('pass', 'fail', 'warning', 'pending')),
  findings    JSONB DEFAULT '[]',
  checked_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE data_retention_policies (
  id                     UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  institution_id         UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  name                   TEXT NOT NULL,
  retention_period_months INTEGER NOT NULL,
  applies_to             TEXT[] DEFAULT '{}',
  action_on_expiry       TEXT DEFAULT 'flag' CHECK (action_on_expiry IN ('flag', 'archive', 'delete')),
  is_active              BOOLEAN DEFAULT true,
  created_at             TIMESTAMPTZ DEFAULT now()
);


-- ════════════════════════════════════════
-- DIGITAL CONSENT MANAGEMENT
-- ════════════════════════════════════════
CREATE TABLE consent_forms (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  version     INTEGER DEFAULT 1,
  content     JSONB NOT NULL,
  language    TEXT DEFAULT 'en',
  is_active   BOOLEAN DEFAULT true,
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMPTZ,
  created_by  UUID REFERENCES profiles(id),
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE consent_records (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  form_id          UUID NOT NULL REFERENCES consent_forms(id),
  project_id       UUID NOT NULL REFERENCES projects(id),
  participant_id   TEXT NOT NULL,
  consent_tiers    JSONB NOT NULL,
  signature_path   TEXT,
  consented_at     TIMESTAMPTZ NOT NULL,
  withdrawn_at     TIMESTAMPTZ,
  withdrawal_reason TEXT,
  collected_by     UUID REFERENCES profiles(id),
  location         TEXT,
  device_info      TEXT,
  created_at       TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE consent_withdrawals (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  consent_id        UUID NOT NULL REFERENCES consent_records(id) ON DELETE CASCADE,
  requested_at      TIMESTAMPTZ DEFAULT now(),
  requested_by      TEXT,
  action_taken      TEXT CHECK (action_taken IN (
                      'data_anonymized', 'data_deleted', 'data_retained_with_justification', 'pending'
                    )),
  action_by         UUID REFERENCES profiles(id),
  action_at         TIMESTAMPTZ,
  justification     TEXT,
  affected_datasets JSONB DEFAULT '[]',
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_consent_records_project ON consent_records(project_id);
CREATE INDEX idx_consent_records_participant ON consent_records(participant_id);
CREATE INDEX idx_consent_forms_project ON consent_forms(project_id);

-- ════════════════════════════════════════
-- DATA MANAGEMENT PLANS
-- ════════════════════════════════════════
CREATE TABLE data_management_plans (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id   UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  funder       TEXT NOT NULL CHECK (funder IN (
                 'nih', 'wellcome', 'erc', 'gates', 'horizon_europe', 'custom'
               )),
  status       TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved')),
  content      JSONB NOT NULL DEFAULT '{}',
  created_by   UUID REFERENCES profiles(id),
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_dmp_project ON data_management_plans(project_id);

-- ════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ════════════════════════════════════════
ALTER TABLE network_datasets ENABLE ROW LEVEL SECURITY;
ALTER TABLE dataset_access_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE cross_institution_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_retention_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE consent_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE consent_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE consent_withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_management_plans ENABLE ROW LEVEL SECURITY;

-- Network datasets: public metadata, controlled data access
CREATE POLICY "Network datasets metadata is public" ON network_datasets
  FOR SELECT TO authenticated USING (
    visibility IN ('metadata_only', 'request_access', 'open')
    AND (embargo_until IS NULL OR embargo_until <= CURRENT_DATE)
  );

CREATE POLICY "Network datasets owned by institution" ON network_datasets
  FOR ALL TO authenticated USING (
    institution_id IN (
      SELECT institution_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Access requests: requester or dataset owner
CREATE POLICY "Access requests visible to requester" ON dataset_access_requests
  FOR SELECT TO authenticated USING (
    requester_id = auth.uid()
    OR network_dataset_id IN (
      SELECT id FROM network_datasets WHERE institution_id IN (
        SELECT institution_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Access requests created by requester" ON dataset_access_requests
  FOR INSERT TO authenticated WITH CHECK (requester_id = auth.uid());

-- Cross-institution invites
CREATE POLICY "Invites visible to inviter or invitee email" ON cross_institution_invites
  FOR SELECT TO authenticated USING (
    inviter_id = auth.uid()
    OR invitee_email IN (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- Compliance profiles: institution admin only
CREATE POLICY "Compliance profiles for institution" ON compliance_profiles
  FOR ALL TO authenticated USING (
    institution_id IN (
      SELECT institution_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Compliance checks: project team
CREATE POLICY "Compliance checks for project team" ON compliance_checks
  FOR SELECT TO authenticated USING (
    project_id IN (SELECT id FROM projects WHERE owner_id = auth.uid())
  );

-- Data retention policies: institution
CREATE POLICY "Retention policies for institution" ON data_retention_policies
  FOR ALL TO authenticated USING (
    institution_id IN (
      SELECT institution_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Consent forms: project team
CREATE POLICY "Consent forms for project team" ON consent_forms
  FOR ALL TO authenticated USING (
    project_id IN (SELECT id FROM projects WHERE owner_id = auth.uid())
  );

-- Consent records: project owner and PI only
CREATE POLICY "Consent records for project team" ON consent_records
  FOR SELECT TO authenticated USING (
    project_id IN (SELECT id FROM projects WHERE owner_id = auth.uid())
  );

CREATE POLICY "Consent records insert by project team" ON consent_records
  FOR INSERT TO authenticated WITH CHECK (
    project_id IN (SELECT id FROM projects WHERE owner_id = auth.uid())
  );

-- Consent withdrawals: project team
CREATE POLICY "Consent withdrawals for project team" ON consent_withdrawals
  FOR ALL TO authenticated USING (
    consent_id IN (
      SELECT id FROM consent_records WHERE project_id IN (
        SELECT id FROM projects WHERE owner_id = auth.uid()
      )
    )
  );

-- DMPs: project owner
CREATE POLICY "DMPs for project owner" ON data_management_plans
  FOR ALL TO authenticated USING (
    project_id IN (SELECT id FROM projects WHERE owner_id = auth.uid())
  );
