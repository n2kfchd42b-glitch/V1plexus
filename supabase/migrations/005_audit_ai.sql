-- ════════════════════════════════════════
-- AUDIT LOG (APPEND-ONLY)
-- ════════════════════════════════════════
CREATE TABLE audit_logs (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  timestamp       TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor_id        UUID REFERENCES profiles(id),
  action          TEXT NOT NULL,
  resource_type   TEXT NOT NULL,
  resource_id     UUID NOT NULL,
  project_id      UUID,
  institution_id  UUID,
  details         JSONB NOT NULL DEFAULT '{}',
  ip_address      INET,
  prev_hash       TEXT,
  entry_hash      TEXT NOT NULL
);

-- Performance indexes
CREATE INDEX idx_audit_actor ON audit_logs(actor_id, timestamp DESC);
CREATE INDEX idx_audit_resource ON audit_logs(resource_type, resource_id, timestamp DESC);
CREATE INDEX idx_audit_project ON audit_logs(project_id, timestamp DESC) WHERE project_id IS NOT NULL;
CREATE INDEX idx_audit_institution ON audit_logs(institution_id, timestamp DESC) WHERE institution_id IS NOT NULL;
CREATE INDEX idx_audit_action ON audit_logs(action, timestamp DESC);

-- CRITICAL: Make this table append-only
-- After migration, run in Supabase SQL editor:
-- REVOKE UPDATE, DELETE ON audit_logs FROM authenticated;
-- REVOKE UPDATE, DELETE ON audit_logs FROM anon;

-- RLS: users can read audit logs for their projects
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read project audit logs" ON audit_logs
  FOR SELECT TO authenticated USING (
    project_id IN (
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
      UNION SELECT id FROM projects WHERE owner_id = auth.uid()
    )
    OR actor_id = auth.uid()
  );

-- Only service role (Edge Functions) can insert audit logs
CREATE POLICY "Service role can insert audit logs" ON audit_logs
  FOR INSERT TO service_role WITH CHECK (true);


-- ════════════════════════════════════════
-- AI USAGE LOG (track AI feature usage)
-- ════════════════════════════════════════
CREATE TABLE ai_usage_log (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES profiles(id),
  action          TEXT NOT NULL,
  document_id     UUID REFERENCES documents(id),
  input_tokens    INTEGER,
  output_tokens   INTEGER,
  model           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE ai_usage_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own AI usage" ON ai_usage_log
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Service role can insert AI usage" ON ai_usage_log
  FOR INSERT TO service_role WITH CHECK (true);
