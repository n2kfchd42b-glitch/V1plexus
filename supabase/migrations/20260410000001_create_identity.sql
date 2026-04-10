-- PLEXUS Phase 2 — Identity Service + Managed CA
-- Creates the three identity tables and the ca_private_keys secure vault.

-- ── institutions ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS institutions (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                  TEXT NOT NULL,
    short_name            TEXT,
    country               TEXT NOT NULL,
    email_domain          TEXT NOT NULL UNIQUE,
    verification_tier     TEXT NOT NULL CHECK (
                            verification_tier IN (
                                'SELF_ATTESTED',
                                'DOMAIN_VERIFIED',
                                'OFFICIALLY_REGISTERED'
                            )
                          ),
    root_public_key       TEXT,
    plexus_managed_ca     BOOLEAN DEFAULT true,
    registration_document TEXT,
    verified_at           TIMESTAMPTZ,
    verified_by           UUID,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    active                BOOLEAN DEFAULT true
);

-- ── identity_attestations ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS identity_attestations (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id              UUID NOT NULL REFERENCES auth.users(id),
    institution_id        UUID REFERENCES institutions(id),
    identity_key          TEXT NOT NULL,
    verification_tier     TEXT NOT NULL CHECK (
                            verification_tier IN (
                                'SELF_ATTESTED',
                                'DOMAIN_VERIFIED',
                                'OFFICIALLY_REGISTERED'
                            )
                          ),
    attested_by           TEXT NOT NULL CHECK (
                            attested_by IN (
                                'SELF',
                                'PLEXUS_CA',
                                'INSTITUTION'
                            )
                          ),
    affiliation_claim     JSONB NOT NULL,
    attestation_signature TEXT NOT NULL,
    valid_from            TIMESTAMPTZ NOT NULL,
    valid_to              TIMESTAMPTZ NOT NULL,
    revoked               BOOLEAN DEFAULT false,
    revoked_at            TIMESTAMPTZ,
    revocation_reason     TEXT,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── identity_key_registry ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS identity_key_registry (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id       UUID NOT NULL REFERENCES auth.users(id),
    attestation_id UUID NOT NULL REFERENCES identity_attestations(id),
    public_key     TEXT NOT NULL UNIQUE,
    key_type       TEXT NOT NULL DEFAULT 'Ed25519',
    key_purpose    TEXT NOT NULL CHECK (
                     key_purpose IN ('identity', 'signing', 'session')
                   ),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at     TIMESTAMPTZ NOT NULL,
    revoked        BOOLEAN DEFAULT false,
    revoked_at     TIMESTAMPTZ
);

-- ── ca_private_keys (secure vault) ───────────────────────────────────────────
-- This table is NEVER exposed via any API endpoint.
-- RLS: deny all — accessible only through the service-role key
-- (application layer via IdentityService internals).

CREATE TABLE IF NOT EXISTS ca_private_keys (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id        UUID NOT NULL REFERENCES institutions(id),
    encrypted_private_key TEXT NOT NULL,
    encryption_algorithm  TEXT NOT NULL DEFAULT 'AES-256-GCM',
    key_version           INTEGER NOT NULL DEFAULT 1,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE ca_private_keys ENABLE ROW LEVEL SECURITY;
-- No policies defined → RLS denies all authenticated/anon access.
-- The Supabase service-role key (used by IdentityService) bypasses RLS.

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_institutions_email_domain
    ON institutions (email_domain);

CREATE INDEX IF NOT EXISTS idx_identity_attestations_actor_id
    ON identity_attestations (actor_id);

CREATE INDEX IF NOT EXISTS idx_identity_attestations_actor_revoked
    ON identity_attestations (actor_id, revoked, valid_to);

CREATE INDEX IF NOT EXISTS idx_identity_key_registry_actor
    ON identity_key_registry (actor_id);

CREATE INDEX IF NOT EXISTS idx_ca_private_keys_institution
    ON ca_private_keys (institution_id);
