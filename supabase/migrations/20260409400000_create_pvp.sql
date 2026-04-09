-- ============================================================================
-- PLEXUS Verification Package (PVP) table
-- Tracks the lifecycle of each packaged, signed, and sealed PVP artifact.
-- Additive migration — no existing tables touched.
-- ============================================================================

CREATE TABLE IF NOT EXISTS pvp_packages (
  id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id             UUID        NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  pvp_format_version     TEXT        NOT NULL DEFAULT '1.0',
  ptls_version           TEXT        NOT NULL DEFAULT '0.1',
  root_hash              VARCHAR(64) NOT NULL,
  total_events           INTEGER     NOT NULL,
  status                 TEXT        NOT NULL CHECK (
                           status IN (
                             'building',
                             'unsigned',
                             'author_signed',
                             'supervisor_signed',
                             'sealed'
                           )
                         ),
  storage_path           TEXT,
  built_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  sealed_at              TIMESTAMPTZ,
  author_signature       TEXT,
  supervisor_signature   TEXT,
  institutional_boundary TEXT        NOT NULL CHECK (
                           institutional_boundary IN (
                             'institutional',
                             'journal'
                           )
                         ),
  deployment_mode        TEXT        NOT NULL DEFAULT 'cloud'
);

CREATE INDEX idx_pvp_packages_project  ON pvp_packages(project_id);
CREATE INDEX idx_pvp_packages_status   ON pvp_packages(status);
CREATE INDEX idx_pvp_packages_built_at ON pvp_packages(built_at);

-- ── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE pvp_packages ENABLE ROW LEVEL SECURITY;

-- Project members can read PVP records for their projects
CREATE POLICY "pvp_packages_select"
  ON pvp_packages FOR SELECT
  USING (
    project_id IN (
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
    )
  );

-- Project members can insert (service role used in practice)
CREATE POLICY "pvp_packages_insert"
  ON pvp_packages FOR INSERT
  WITH CHECK (
    project_id IN (
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
    )
  );

-- Allow status/signature updates (signing and sealing flow)
CREATE POLICY "pvp_packages_update"
  ON pvp_packages FOR UPDATE
  USING (
    project_id IN (
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
    )
  );

-- No DELETE policy — sealed packages are permanent records
REVOKE DELETE ON pvp_packages FROM PUBLIC;
