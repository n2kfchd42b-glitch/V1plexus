-- ============================================================
-- Phase 5: Research Output Layer
-- ============================================================

-- ============================================================
-- TABLE 1: reporting_checklists
-- ============================================================

CREATE TABLE public.reporting_checklists (
  id                   UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id           UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  dataset_id           UUID NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
  version_id           UUID NOT NULL REFERENCES dataset_versions(id) ON DELETE CASCADE,
  guideline            TEXT NOT NULL CHECK (guideline IN ('STROBE','CONSORT','PRISMA','TRIPOD','ARRIVE','CHEERS')),
  study_design         TEXT,
  items                JSONB NOT NULL DEFAULT '{}',
  total_items          INTEGER NOT NULL,
  auto_populated       INTEGER NOT NULL DEFAULT 0,
  manually_completed   INTEGER NOT NULL DEFAULT 0,
  not_applicable       INTEGER NOT NULL DEFAULT 0,
  incomplete           INTEGER NOT NULL DEFAULT 0,
  submission_ready     BOOLEAN NOT NULL DEFAULT false,
  created_by           UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at           TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at           TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_reporting_checklists_project ON public.reporting_checklists(project_id);
CREATE INDEX idx_reporting_checklists_dataset ON public.reporting_checklists(dataset_id);
CREATE INDEX idx_reporting_checklists_version ON public.reporting_checklists(version_id);
CREATE INDEX idx_reporting_checklists_created_by ON public.reporting_checklists(created_by);

CREATE TRIGGER set_reporting_checklists_updated_at
  BEFORE UPDATE ON public.reporting_checklists
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE public.reporting_checklists ENABLE ROW LEVEL SECURITY;

-- Project members can view checklists
CREATE POLICY "project_members_select_checklists"
  ON public.reporting_checklists FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = reporting_checklists.project_id
        AND pm.user_id = auth.uid()
    )
  );

-- Creator can insert
CREATE POLICY "creator_insert_checklist"
  ON public.reporting_checklists FOR INSERT
  WITH CHECK (created_by = auth.uid());

-- Project members can update
CREATE POLICY "project_members_update_checklists"
  ON public.reporting_checklists FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = reporting_checklists.project_id
        AND pm.user_id = auth.uid()
    )
  );

-- ============================================================
-- TABLE 2: output_packages
-- ============================================================

CREATE TABLE public.output_packages (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id     UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  dataset_id     UUID NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
  version_id     UUID NOT NULL REFERENCES dataset_versions(id) ON DELETE CASCADE,
  manifest       JSONB NOT NULL DEFAULT '{}',
  package_hash   TEXT,
  storage_path   TEXT,
  status         TEXT NOT NULL DEFAULT 'generating'
                   CHECK (status IN ('generating','ready','failed')),
  generated_by   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  generated_at   TIMESTAMPTZ DEFAULT now() NOT NULL,
  expires_at     TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '30 days')
);

CREATE INDEX idx_output_packages_project ON public.output_packages(project_id);
CREATE INDEX idx_output_packages_dataset ON public.output_packages(dataset_id);
CREATE INDEX idx_output_packages_version ON public.output_packages(version_id);
CREATE INDEX idx_output_packages_generated_by ON public.output_packages(generated_by);
CREATE INDEX idx_output_packages_status ON public.output_packages(status);

ALTER TABLE public.output_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "project_members_select_packages"
  ON public.output_packages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = output_packages.project_id
        AND pm.user_id = auth.uid()
    )
  );

CREATE POLICY "authenticated_insert_packages"
  ON public.output_packages FOR INSERT
  WITH CHECK (generated_by = auth.uid());

CREATE POLICY "authenticated_update_packages"
  ON public.output_packages FOR UPDATE
  USING (generated_by = auth.uid());

-- ============================================================
-- TABLE 3: verification_tokens
-- ============================================================

CREATE TABLE public.verification_tokens (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  resource_type       TEXT NOT NULL CHECK (resource_type IN ('dataset_lineage','analysis_run','output_package','approval')),
  resource_id         UUID NOT NULL,
  project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  token               TEXT NOT NULL UNIQUE,
  access_level        TEXT NOT NULL DEFAULT 'summary' CHECK (access_level IN ('summary','full')),
  restricted_to_email TEXT,
  created_by          UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at          TIMESTAMPTZ DEFAULT now() NOT NULL,
  expires_at          TIMESTAMPTZ NOT NULL,
  view_count          INTEGER NOT NULL DEFAULT 0,
  last_viewed_at      TIMESTAMPTZ,
  revoked_at          TIMESTAMPTZ
);

CREATE UNIQUE INDEX idx_verification_tokens_token ON public.verification_tokens(token);
CREATE INDEX idx_verification_tokens_project ON public.verification_tokens(project_id);
CREATE INDEX idx_verification_tokens_resource ON public.verification_tokens(resource_type, resource_id);
CREATE INDEX idx_verification_tokens_created_by ON public.verification_tokens(created_by);
CREATE INDEX idx_verification_tokens_expires ON public.verification_tokens(expires_at);

ALTER TABLE public.verification_tokens ENABLE ROW LEVEL SECURITY;

-- Project members can view their tokens
CREATE POLICY "project_members_select_tokens"
  ON public.verification_tokens FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = verification_tokens.project_id
        AND pm.user_id = auth.uid()
    )
  );

-- Creator can insert
CREATE POLICY "creator_insert_token"
  ON public.verification_tokens FOR INSERT
  WITH CHECK (created_by = auth.uid());

-- Creator can update (revoke, etc.)
CREATE POLICY "creator_update_token"
  ON public.verification_tokens FOR UPDATE
  USING (created_by = auth.uid());

-- Service role can update view counts (for public verify page)
CREATE POLICY "service_role_update_tokens"
  ON public.verification_tokens FOR UPDATE
  USING (auth.role() = 'service_role');

-- ============================================================
-- Add FK constraints from portfolio tables to verification_tokens
-- (deferred here because verification_tokens didn't exist when
--  the portfolio migration ran)
-- ============================================================

ALTER TABLE public.portfolio_publications
  ADD CONSTRAINT fk_pub_verification_token
  FOREIGN KEY (verification_token_id)
  REFERENCES public.verification_tokens(id)
  ON DELETE SET NULL;

ALTER TABLE public.portfolio_certificates
  ADD CONSTRAINT fk_cert_verification_token
  FOREIGN KEY (verification_token_id)
  REFERENCES public.verification_tokens(id)
  ON DELETE SET NULL;
