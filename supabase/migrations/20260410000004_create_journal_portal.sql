-- ─────────────────────────────────────────────────────────────
-- PLEXUS Journal Verification Portal — Migration
-- Tables: verification_requests, verification_certificates
--
-- Access model:
--   • All writes: service role only (RLS denies user INSERT/UPDATE/DELETE)
--   • verification_certificates: public SELECT allowed
--   • verification_requests: no user SELECT (hashed IPs, internal only)
-- ─────────────────────────────────────────────────────────────

-- ── verification_requests ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS verification_requests (
    request_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pvp_id              UUID,                           -- null if format validation fails early
    requester_ip_hash   TEXT        NOT NULL,           -- sha256(ip) — never store raw IP
    pvp_format_version  TEXT,
    verification_status TEXT        NOT NULL
        CHECK (verification_status IN ('passed', 'failed', 'error')),
    trust_level         INTEGER,                        -- 0–3; null on format error
    aad_flags           JSONB       NOT NULL DEFAULT '[]',
    error_detail        TEXT,                           -- populated on 'error' status
    processing_ms       INTEGER     NOT NULL,           -- wall-clock ms for SLA tracking
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_verification_requests_pvp_id
    ON verification_requests (pvp_id)
    WHERE pvp_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_verification_requests_created_at
    ON verification_requests (created_at DESC);

-- RLS: deny all user access — service role bypasses RLS
ALTER TABLE verification_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "no_user_access_verification_requests"
    ON verification_requests
    FOR ALL
    TO authenticated
    USING (false)
    WITH CHECK (false);


-- ── verification_certificates ─────────────────────────────────

CREATE TABLE IF NOT EXISTS verification_certificates (
    certificate_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pvp_id              UUID        NOT NULL,
    project_id          UUID        NOT NULL,
    trust_level         INTEGER     NOT NULL CHECK (trust_level BETWEEN 0 AND 3),
    trust_label         TEXT        NOT NULL,
    aad_flags           JSONB       NOT NULL DEFAULT '[]',
    integrity_passed    BOOLEAN     NOT NULL,
    root_hash           TEXT        NOT NULL,
    human_readable      TEXT        NOT NULL,           -- pre-rendered text report
    portal_signature    TEXT        NOT NULL,           -- hex Ed25519 signature over canonical JSON
    issued_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at          TIMESTAMPTZ NOT NULL,           -- issued_at + 90 days
    request_id          UUID        REFERENCES verification_requests (request_id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_verification_certificates_pvp_id
    ON verification_certificates (pvp_id);

CREATE INDEX IF NOT EXISTS idx_verification_certificates_issued_at
    ON verification_certificates (issued_at DESC);

-- RLS: public SELECT on certificates; no user write access
ALTER TABLE verification_certificates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_verification_certificates"
    ON verification_certificates
    FOR SELECT
    TO anon, authenticated
    USING (true);

CREATE POLICY "no_user_write_verification_certificates"
    ON verification_certificates
    FOR INSERT
    TO authenticated
    WITH CHECK (false);

CREATE POLICY "no_user_update_verification_certificates"
    ON verification_certificates
    FOR UPDATE
    TO authenticated
    USING (false)
    WITH CHECK (false);

CREATE POLICY "no_user_delete_verification_certificates"
    ON verification_certificates
    FOR DELETE
    TO authenticated
    USING (false);
