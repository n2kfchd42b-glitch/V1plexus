-- Phase 7: Field Operations Layer
-- Integration connections, sync logs, data quality, field chat, push subscriptions

-- ─────────────────────────────────────────────
-- Integration Connections
-- ─────────────────────────────────────────────

CREATE TABLE integration_connections (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  provider        TEXT NOT NULL CHECK (provider IN (
                    'kobotoolbox', 'redcap', 'odk_central', 'surveycto', 'commcare', 'dhis2'
                  )),
  config          JSONB NOT NULL DEFAULT '{}',
  status          TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'error', 'disconnected')),
  last_sync_at    TIMESTAMPTZ,
  last_sync_status TEXT,
  sync_frequency  TEXT DEFAULT 'realtime' CHECK (sync_frequency IN ('realtime', 'hourly', 'daily', 'manual')),
  total_synced    INTEGER DEFAULT 0,
  error_log       TEXT,
  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE sync_log (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  connection_id       UUID NOT NULL REFERENCES integration_connections(id) ON DELETE CASCADE,
  sync_type           TEXT NOT NULL CHECK (sync_type IN ('full', 'incremental', 'manual', 'webhook')),
  records_fetched     INTEGER DEFAULT 0,
  records_new         INTEGER DEFAULT 0,
  records_updated     INTEGER DEFAULT 0,
  records_skipped     INTEGER DEFAULT 0,
  quality_issues      INTEGER DEFAULT 0,
  dataset_version_id  UUID,
  status              TEXT DEFAULT 'completed',
  error_message       TEXT,
  started_at          TIMESTAMPTZ DEFAULT now(),
  completed_at        TIMESTAMPTZ,
  duration_ms         INTEGER
);

CREATE INDEX idx_integrations_project ON integration_connections(project_id);
CREATE INDEX idx_sync_log_connection ON sync_log(connection_id, started_at DESC);

-- ─────────────────────────────────────────────
-- Data Quality Rules & Results
-- ─────────────────────────────────────────────

CREATE TABLE data_quality_rules (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  dataset_id      UUID NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  rule_type       TEXT NOT NULL CHECK (rule_type IN (
                    'range', 'required', 'format', 'unique', 'logical',
                    'cross_field', 'outlier', 'completeness', 'consistency'
                  )),
  column_name     TEXT,
  config          JSONB NOT NULL DEFAULT '{}',
  severity        TEXT DEFAULT 'warning' CHECK (severity IN ('error', 'warning', 'info')),
  is_active       BOOLEAN DEFAULT true,
  auto_generated  BOOLEAN DEFAULT false,
  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE data_quality_results (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  dataset_id          UUID NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
  version_id          UUID NOT NULL REFERENCES dataset_versions(id) ON DELETE CASCADE,
  rule_id             UUID NOT NULL REFERENCES data_quality_rules(id) ON DELETE CASCADE,
  violations_count    INTEGER NOT NULL DEFAULT 0,
  total_checked       INTEGER NOT NULL DEFAULT 0,
  sample_violations   JSONB DEFAULT '[]',
  status              TEXT DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'ignored', 'expected')),
  resolved_by         UUID REFERENCES profiles(id),
  resolved_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE data_quality_scores (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  dataset_id      UUID NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
  version_id      UUID NOT NULL REFERENCES dataset_versions(id) ON DELETE CASCADE,
  overall_score   DECIMAL(5,2) NOT NULL,
  completeness    DECIMAL(5,2),
  validity        DECIMAL(5,2),
  uniqueness      DECIMAL(5,2),
  consistency     DECIMAL(5,2),
  errors_count    INTEGER DEFAULT 0,
  warnings_count  INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_dq_rules_dataset ON data_quality_rules(dataset_id);
CREATE INDEX idx_dq_results_version ON data_quality_results(version_id);
CREATE INDEX idx_dq_scores_dataset ON data_quality_scores(dataset_id, created_at DESC);

-- ─────────────────────────────────────────────
-- Field Team Chat
-- ─────────────────────────────────────────────

CREATE TABLE project_messages (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  sender_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_messages_project ON project_messages(project_id, created_at DESC);

-- ─────────────────────────────────────────────
-- Push Notification Subscriptions
-- ─────────────────────────────────────────────

CREATE TABLE push_subscriptions (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  endpoint    TEXT NOT NULL,
  keys        JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, endpoint)
);

CREATE INDEX idx_push_subscriptions_user ON push_subscriptions(user_id);

-- ─────────────────────────────────────────────
-- RLS Policies
-- ─────────────────────────────────────────────

ALTER TABLE integration_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_quality_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_quality_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_quality_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Helper: project membership check
CREATE OR REPLACE FUNCTION is_project_member(p_project_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM project_members
    WHERE project_id = p_project_id AND user_id = auth.uid()
    UNION
    SELECT 1 FROM projects
    WHERE id = p_project_id AND owner_id = auth.uid()
  );
$$;

-- integration_connections
CREATE POLICY "Project members can view integrations"
  ON integration_connections FOR SELECT TO authenticated
  USING (is_project_member(project_id));

CREATE POLICY "Project members can manage integrations"
  ON integration_connections FOR ALL TO authenticated
  USING (is_project_member(project_id))
  WITH CHECK (is_project_member(project_id));

-- sync_log
CREATE POLICY "Project members can view sync logs"
  ON sync_log FOR SELECT TO authenticated
  USING (
    connection_id IN (
      SELECT id FROM integration_connections
      WHERE is_project_member(project_id)
    )
  );

CREATE POLICY "Service can insert sync logs"
  ON sync_log FOR INSERT TO authenticated
  WITH CHECK (
    connection_id IN (
      SELECT id FROM integration_connections
      WHERE is_project_member(project_id)
    )
  );

-- data_quality_rules
CREATE POLICY "Project members can view quality rules"
  ON data_quality_rules FOR SELECT TO authenticated
  USING (
    dataset_id IN (
      SELECT id FROM datasets WHERE is_project_member(project_id)
    )
  );

CREATE POLICY "Project members can manage quality rules"
  ON data_quality_rules FOR ALL TO authenticated
  USING (
    dataset_id IN (
      SELECT id FROM datasets WHERE is_project_member(project_id)
    )
  )
  WITH CHECK (
    dataset_id IN (
      SELECT id FROM datasets WHERE is_project_member(project_id)
    )
  );

-- data_quality_results
CREATE POLICY "Project members can view quality results"
  ON data_quality_results FOR SELECT TO authenticated
  USING (
    dataset_id IN (
      SELECT id FROM datasets WHERE is_project_member(project_id)
    )
  );

CREATE POLICY "Project members can manage quality results"
  ON data_quality_results FOR ALL TO authenticated
  USING (
    dataset_id IN (
      SELECT id FROM datasets WHERE is_project_member(project_id)
    )
  )
  WITH CHECK (
    dataset_id IN (
      SELECT id FROM datasets WHERE is_project_member(project_id)
    )
  );

-- data_quality_scores
CREATE POLICY "Project members can view quality scores"
  ON data_quality_scores FOR SELECT TO authenticated
  USING (
    dataset_id IN (
      SELECT id FROM datasets WHERE is_project_member(project_id)
    )
  );

CREATE POLICY "Project members can manage quality scores"
  ON data_quality_scores FOR ALL TO authenticated
  USING (
    dataset_id IN (
      SELECT id FROM datasets WHERE is_project_member(project_id)
    )
  )
  WITH CHECK (
    dataset_id IN (
      SELECT id FROM datasets WHERE is_project_member(project_id)
    )
  );

-- project_messages
CREATE POLICY "Project members can view messages"
  ON project_messages FOR SELECT TO authenticated
  USING (is_project_member(project_id));

CREATE POLICY "Project members can send messages"
  ON project_messages FOR INSERT TO authenticated
  WITH CHECK (is_project_member(project_id) AND sender_id = auth.uid());

-- push_subscriptions
CREATE POLICY "Users manage own push subscriptions"
  ON push_subscriptions FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ─────────────────────────────────────────────
-- Realtime
-- ─────────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE project_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE integration_connections;
ALTER PUBLICATION supabase_realtime ADD TABLE data_quality_scores;
