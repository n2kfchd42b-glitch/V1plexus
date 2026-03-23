-- Phase 10: External Integrations Hub
-- REDCap, SurveyCTO, ODK, DHIS2, Zotero — Universal Connector Framework

-- ─────────────────────────────────────────────
-- Extend integration_connections with Phase 10 fields
-- ─────────────────────────────────────────────

ALTER TABLE integration_connections
  ADD COLUMN IF NOT EXISTS display_name TEXT,
  ADD COLUMN IF NOT EXISTS provider_project_id TEXT,
  ADD COLUMN IF NOT EXISTS provider_project_name TEXT,
  ADD COLUMN IF NOT EXISTS column_mapping JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS sync_direction TEXT DEFAULT 'pull'
    CHECK (sync_direction IN ('pull', 'push', 'bidirectional')),
  ADD COLUMN IF NOT EXISTS webhook_url TEXT,
  ADD COLUMN IF NOT EXISTS webhook_secret TEXT;

-- Extend provider support to include Zotero and Mendeley
-- We do this by dropping and recreating the check constraint
ALTER TABLE integration_connections
  DROP CONSTRAINT IF EXISTS integration_connections_provider_check;

ALTER TABLE integration_connections
  ADD CONSTRAINT integration_connections_provider_check
    CHECK (provider IN (
      'kobotoolbox', 'redcap', 'odk_central', 'surveycto',
      'commcare', 'dhis2', 'zotero', 'mendeley'
    ));

-- ─────────────────────────────────────────────
-- Field Mappings (per integration connection)
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS integration_field_mappings (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  connection_id   UUID NOT NULL REFERENCES integration_connections(id) ON DELETE CASCADE,
  remote_field    TEXT NOT NULL,
  local_column    TEXT NOT NULL,
  transform       JSONB,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_field_mappings_connection
  ON integration_field_mappings(connection_id);

-- ─────────────────────────────────────────────
-- DHIS2 Push Logs (for tracking push operations)
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS dhis2_push_logs (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  connection_id     UUID NOT NULL REFERENCES integration_connections(id) ON DELETE CASCADE,
  push_type         TEXT DEFAULT 'data_values' CHECK (push_type IN ('data_values', 'events', 'tracked_entities')),
  period            TEXT,
  org_unit          TEXT,
  data_values_count INTEGER DEFAULT 0,
  status            TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'dry_run', 'success', 'failed', 'partial')),
  import_summary    JSONB,
  validation_issues JSONB DEFAULT '[]',
  started_at        TIMESTAMPTZ DEFAULT now(),
  completed_at      TIMESTAMPTZ,
  created_by        UUID REFERENCES profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_dhis2_push_logs_connection
  ON dhis2_push_logs(connection_id, started_at DESC);

-- ─────────────────────────────────────────────
-- Zotero Sync State
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS zotero_sync_state (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  connection_id   UUID NOT NULL REFERENCES integration_connections(id) ON DELETE CASCADE,
  library_version INTEGER DEFAULT 0,
  last_synced_at  TIMESTAMPTZ,
  item_count      INTEGER DEFAULT 0,
  UNIQUE(connection_id)
);

-- ─────────────────────────────────────────────
-- RLS Policies
-- ─────────────────────────────────────────────

ALTER TABLE integration_field_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE dhis2_push_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE zotero_sync_state ENABLE ROW LEVEL SECURITY;

-- Field mappings: accessible via the parent connection (which is via project)
CREATE POLICY "field_mappings_project_access" ON integration_field_mappings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM integration_connections ic
      JOIN project_members pm ON pm.project_id = ic.project_id
      WHERE ic.id = integration_field_mappings.connection_id
        AND pm.user_id = auth.uid()
    )
  );

-- DHIS2 push logs: same pattern
CREATE POLICY "dhis2_push_logs_project_access" ON dhis2_push_logs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM integration_connections ic
      JOIN project_members pm ON pm.project_id = ic.project_id
      WHERE ic.id = dhis2_push_logs.connection_id
        AND pm.user_id = auth.uid()
    )
  );

-- Zotero sync state: same pattern
CREATE POLICY "zotero_sync_state_project_access" ON zotero_sync_state
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM integration_connections ic
      JOIN project_members pm ON pm.project_id = ic.project_id
      WHERE ic.id = zotero_sync_state.connection_id
        AND pm.user_id = auth.uid()
    )
  );
