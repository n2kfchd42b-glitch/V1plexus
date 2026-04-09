-- ============================================================================
-- PLEXUS Cryptographic Ledger
-- Creates append-only, Ed25519-signed ledger_events and ledger_session_keys.
-- Additive migration — no existing tables touched.
-- ============================================================================

-- ── Session keys (public half only; private key is NEVER stored) ─────────────

CREATE TABLE IF NOT EXISTS ledger_session_keys (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    UUID        NOT NULL,
  project_id  UUID        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  public_key  TEXT        NOT NULL,           -- Ed25519 verify key, hex-encoded
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked     BOOLEAN     NOT NULL DEFAULT false,
  revoked_at  TIMESTAMPTZ
);

CREATE INDEX idx_ledger_session_keys_actor   ON ledger_session_keys(actor_id);
CREATE INDEX idx_ledger_session_keys_project ON ledger_session_keys(project_id);

-- ── Append-only event ledger ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ledger_events (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID        NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  sequence_number INTEGER     NOT NULL,
  event_type      TEXT        NOT NULL,
  payload         JSONB       NOT NULL,
  previous_hash   VARCHAR(64) NOT NULL,
  event_hash      VARCHAR(64) NOT NULL,
  signature       TEXT        NOT NULL,       -- Ed25519 signature of event_hash, hex
  session_key_id  UUID        NOT NULL REFERENCES ledger_session_keys(id),
  actor_id        UUID        NOT NULL,
  actor_role      TEXT        NOT NULL CHECK (actor_role IN (
                                'author', 'supervisor', 'institution', 'system'
                              )),
  timestamp       TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT ledger_events_project_seq_unique UNIQUE (project_id, sequence_number)
);

CREATE INDEX idx_ledger_events_project   ON ledger_events(project_id, sequence_number ASC);
CREATE INDEX idx_ledger_events_actor     ON ledger_events(actor_id);
CREATE INDEX idx_ledger_events_type      ON ledger_events(event_type);
CREATE INDEX idx_ledger_events_timestamp ON ledger_events(timestamp);

-- ── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE ledger_session_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_events        ENABLE ROW LEVEL SECURITY;

-- Session keys: project members can read keys for their projects
CREATE POLICY "ledger_session_keys_select"
  ON ledger_session_keys FOR SELECT
  USING (
    project_id IN (
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
    )
  );

-- Session keys: only the owning actor can insert their own key
CREATE POLICY "ledger_session_keys_insert"
  ON ledger_session_keys FOR INSERT
  WITH CHECK (actor_id = auth.uid());

-- Ledger events: project members can read
CREATE POLICY "ledger_events_select"
  ON ledger_events FOR SELECT
  USING (
    project_id IN (
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
    )
  );

-- Ledger events: project members can insert
CREATE POLICY "ledger_events_insert"
  ON ledger_events FOR INSERT
  WITH CHECK (
    project_id IN (
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
    )
  );

-- UPDATE and DELETE are intentionally absent — append-only by policy.
-- Revoke any default privileges that might allow mutation.
REVOKE UPDATE ON ledger_events FROM PUBLIC;
REVOKE DELETE ON ledger_events FROM PUBLIC;
REVOKE UPDATE ON ledger_session_keys FROM PUBLIC;
REVOKE DELETE ON ledger_session_keys FROM PUBLIC;
