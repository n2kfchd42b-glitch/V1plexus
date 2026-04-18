-- ============================================================================
-- CANONICAL VERSION COLUMN + append_audit_entry RPC UPDATE
--
-- Problem:
--   canonicalDetails() in auditLogger.ts uses JSON.stringify with an array
--   replacer (Object.keys(details).sort()). The JS array-replacer only emits
--   a key if its name appears in the top-level allowed-key list — which means
--   nested objects like `details.operation` are serialized as {}, discarding
--   all their content. Entries written before this fix commit to a hash over
--   an effectively empty nested structure.
--
-- Fix strategy:
--   Add a `canonical_version` column:
--     0 = legacy (array-replacer, drops nested keys) — all historical entries
--     1 = v1 (proper recursive key sort, all nested content committed) — all
--         new entries from this migration forward
--
--   The verify route dispatches the correct canonical per entry so old and new
--   entries both verify correctly against their stored hash.
--
--   append_audit_entry RPC gains p_canonical_version (default 0 for backward
--   compatibility; callers set 1 explicitly).
--
-- Safe to re-run (CREATE OR REPLACE, ADD COLUMN IF NOT EXISTS).
-- ============================================================================

SET search_path = public;

-- ── 1. Add canonical_version column ─────────────────────────────────────────

ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS canonical_version SMALLINT NOT NULL DEFAULT 0;

-- ── 2. Recreate append_audit_entry with p_canonical_version param ────────────
--    DROP required because PostgreSQL cannot change parameter list with
--    CREATE OR REPLACE alone. The function body is otherwise identical to
--    the previous version except for the new column in the INSERT.

DROP FUNCTION IF EXISTS public.append_audit_entry(
  UUID, TEXT, TEXT, UUID, UUID, UUID, JSONB, INET, TIMESTAMPTZ,
  TEXT, TEXT, TEXT, TEXT, UUID
);

CREATE FUNCTION public.append_audit_entry(
  p_actor_id                     UUID,
  p_action                       TEXT,
  p_resource_type                TEXT,
  p_resource_id                  UUID,
  p_project_id                   UUID,
  p_institution_id               UUID,
  p_details                      JSONB,
  p_ip_address                   INET,
  p_timestamp                    TIMESTAMPTZ,
  p_expected_resource_prev_hash  TEXT,
  p_resource_entry_hash          TEXT,
  p_expected_project_prev_hash   TEXT,
  p_project_entry_hash           TEXT,
  p_idempotency_key              UUID DEFAULT NULL,
  p_canonical_version            SMALLINT DEFAULT 0
) RETURNS TABLE (
  id                        UUID,
  sequence_number           BIGINT,
  entry_hash                TEXT,
  project_chain_entry_hash  TEXT,
  idempotent_replay         BOOLEAN
) AS $$
DECLARE
  v_lock_key               BIGINT;
  v_current_resource_hash  TEXT;
  v_current_project_hash   TEXT;
  v_current_project_ts     TIMESTAMPTZ;
  v_next_sequence          BIGINT;
  v_existing_row           public.audit_logs%ROWTYPE;
  v_new_id                 UUID;
BEGIN
  -- Idempotency short-circuit (before taking locks)
  IF p_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_existing_row
      FROM public.audit_logs
     WHERE actor_id = p_actor_id AND idempotency_key = p_idempotency_key
     LIMIT 1;
    IF FOUND THEN
      id                       := v_existing_row.id;
      sequence_number          := v_existing_row.sequence_number;
      entry_hash               := v_existing_row.entry_hash;
      project_chain_entry_hash := v_existing_row.project_chain_entry_hash;
      idempotent_replay        := TRUE;
      RETURN NEXT;
      RETURN;
    END IF;
  END IF;

  -- Per-chain advisory lock (project-scoped if available, else resource-scoped)
  v_lock_key := hashtextextended(
    COALESCE(p_project_id::text, p_resource_type || ':' || p_resource_id::text),
    0
  );
  PERFORM pg_advisory_xact_lock(v_lock_key);

  -- Validate resource-chain tail
  SELECT entry_hash INTO v_current_resource_hash
    FROM public.audit_logs
   WHERE resource_type = p_resource_type AND resource_id = p_resource_id
   ORDER BY timestamp DESC, id DESC
   LIMIT 1;

  IF COALESCE(v_current_resource_hash, '') <> COALESCE(p_expected_resource_prev_hash, '') THEN
    RAISE EXCEPTION 'audit chain conflict: resource tail moved (expected %, found %)',
      COALESCE(p_expected_resource_prev_hash, 'GENESIS'),
      COALESCE(v_current_resource_hash, 'GENESIS')
      USING ERRCODE = 'serialization_failure';
  END IF;

  -- Validate project-chain tail + monotonic timestamp + next sequence
  IF p_project_id IS NOT NULL THEN
    SELECT project_chain_entry_hash, timestamp
      INTO v_current_project_hash, v_current_project_ts
      FROM public.audit_logs
     WHERE project_id = p_project_id
       AND project_chain_entry_hash IS NOT NULL
     ORDER BY sequence_number DESC NULLS LAST, timestamp DESC, id DESC
     LIMIT 1;

    IF COALESCE(v_current_project_hash, '') <> COALESCE(p_expected_project_prev_hash, '') THEN
      RAISE EXCEPTION 'audit chain conflict: project tail moved (expected %, found %)',
        COALESCE(p_expected_project_prev_hash, 'PROJECT_GENESIS'),
        COALESCE(v_current_project_hash, 'PROJECT_GENESIS')
        USING ERRCODE = 'serialization_failure';
    END IF;

    IF v_current_project_ts IS NOT NULL AND p_timestamp < v_current_project_ts THEN
      RAISE EXCEPTION 'audit chain violation: timestamp % precedes project tail %',
        p_timestamp, v_current_project_ts
        USING ERRCODE = 'check_violation';
    END IF;

    SELECT COALESCE(MAX(sequence_number), 0) + 1 INTO v_next_sequence
      FROM public.audit_logs
     WHERE project_id = p_project_id;
  END IF;

  v_new_id := gen_random_uuid();

  INSERT INTO public.audit_logs (
    id, timestamp, actor_id, action, resource_type, resource_id,
    project_id, institution_id, details, ip_address,
    prev_hash, entry_hash,
    project_chain_prev_hash, project_chain_entry_hash,
    sequence_number, idempotency_key, hardened, canonical_version
  ) VALUES (
    v_new_id, p_timestamp, p_actor_id, p_action, p_resource_type, p_resource_id,
    p_project_id, p_institution_id, COALESCE(p_details, '{}'::jsonb), p_ip_address,
    p_expected_resource_prev_hash, p_resource_entry_hash,
    p_expected_project_prev_hash, p_project_entry_hash,
    v_next_sequence, p_idempotency_key, TRUE, p_canonical_version
  );

  id                       := v_new_id;
  sequence_number          := v_next_sequence;
  entry_hash               := p_resource_entry_hash;
  project_chain_entry_hash := p_project_entry_hash;
  idempotent_replay        := FALSE;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.append_audit_entry(
  UUID, TEXT, TEXT, UUID, UUID, UUID, JSONB, INET, TIMESTAMPTZ,
  TEXT, TEXT, TEXT, TEXT, UUID, SMALLINT
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.append_audit_entry(
  UUID, TEXT, TEXT, UUID, UUID, UUID, JSONB, INET, TIMESTAMPTZ,
  TEXT, TEXT, TEXT, TEXT, UUID, SMALLINT
) TO service_role;
