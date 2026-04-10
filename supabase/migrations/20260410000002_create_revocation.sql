-- PLEXUS Phase 2, Prompt 5 — Revocation Registry
-- Append-only tables for revoked keys, revoked attestations,
-- retracted packages, and a full audit log.
-- Public read, authenticated write, UPDATE/DELETE denied.

-- ── revoked_keys ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS revoked_keys (
    id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    key_id               UUID        NOT NULL,
    key_type             TEXT        NOT NULL CHECK (
                           key_type IN (
                             'session',
                             'identity',
                             'institution_ca'
                           )
                         ),
    public_key           TEXT        NOT NULL,
    revoked_by           UUID        NOT NULL,
    revocation_reason    TEXT        NOT NULL CHECK (
                           revocation_reason IN (
                             'compromised',
                             'actor_departed',
                             'policy_violation',
                             'routine_rotation',
                             'institution_request'
                           )
                         ),
    revocation_signature TEXT        NOT NULL,
    revoked_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    published_at         TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT revoked_keys_key_id_unique UNIQUE (key_id)
);

ALTER TABLE revoked_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY revoked_keys_public_read
    ON revoked_keys FOR SELECT
    USING (true);

CREATE POLICY revoked_keys_auth_insert
    ON revoked_keys FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- No UPDATE or DELETE policies → denied for all roles.

-- ── revoked_attestations ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS revoked_attestations (
    id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    attestation_id       UUID        NOT NULL,
    actor_id             UUID        NOT NULL,
    institution_id       UUID,
    revoked_by           UUID        NOT NULL,
    revocation_reason    TEXT        NOT NULL CHECK (
                           revocation_reason IN (
                             'identity_fraud',
                             'affiliation_ended',
                             'policy_violation',
                             'institution_request',
                             'actor_request'
                           )
                         ),
    revocation_signature TEXT        NOT NULL,
    revoked_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    published_at         TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT revoked_attestations_attestation_id_unique
        UNIQUE (attestation_id)
);

ALTER TABLE revoked_attestations ENABLE ROW LEVEL SECURITY;

CREATE POLICY revoked_attestations_public_read
    ON revoked_attestations FOR SELECT
    USING (true);

CREATE POLICY revoked_attestations_auth_insert
    ON revoked_attestations FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- ── retracted_packages ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS retracted_packages (
    id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    pvp_root_hash        TEXT        NOT NULL,
    project_id           UUID        NOT NULL,
    retracted_by         UUID        NOT NULL,
    retraction_reason    TEXT        NOT NULL CHECK (
                           retraction_reason IN (
                             'data_integrity_failure',
                             'misconduct',
                             'methodology_error',
                             'author_request',
                             'institution_request',
                             'journal_request'
                           )
                         ),
    retraction_note      TEXT,
    retraction_signature TEXT        NOT NULL,
    retracted_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    published_at         TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT retracted_packages_root_hash_unique UNIQUE (pvp_root_hash)
);

ALTER TABLE retracted_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY retracted_packages_public_read
    ON retracted_packages FOR SELECT
    USING (true);

CREATE POLICY retracted_packages_auth_insert
    ON retracted_packages FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- ── revocation_audit_log ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS revocation_audit_log (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    revocation_type  TEXT        NOT NULL CHECK (
                       revocation_type IN ('key', 'attestation', 'package')
                     ),
    target_id        TEXT        NOT NULL,
    action           TEXT        NOT NULL,
    performed_by     UUID        NOT NULL,
    ip_address       TEXT,
    user_agent       TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE revocation_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY revocation_audit_log_public_read
    ON revocation_audit_log FOR SELECT
    USING (true);

CREATE POLICY revocation_audit_log_auth_insert
    ON revocation_audit_log FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_revoked_keys_key_id
    ON revoked_keys (key_id);

CREATE INDEX IF NOT EXISTS idx_revoked_attestations_attestation_id
    ON revoked_attestations (attestation_id);

CREATE INDEX IF NOT EXISTS idx_retracted_packages_root_hash
    ON retracted_packages (pvp_root_hash);

CREATE INDEX IF NOT EXISTS idx_revocation_audit_log_target
    ON revocation_audit_log (target_id);

CREATE INDEX IF NOT EXISTS idx_revocation_audit_log_performed_by
    ON revocation_audit_log (performed_by);
