-- ============================================================================
-- BOUND `append_audit_entry` LOCK WAIT
--
-- Problem: a stuck/orphaned session holding the per-project advisory lock
-- caused new writes to hang for up to 2 minutes before the Supabase pooler
-- returned `upstream request timeout`. The client saw `audit_write_failed`
-- only after a 2-minute wait.
--
-- Fix: set `lock_timeout = '3s'` at the start of the function so a contended
-- advisory lock raises `lock_not_available` (55P03) instead of hanging. The
-- client-side retry queue will re-enqueue and try again on the next write.
--
-- Behaviour otherwise identical to the previous definition.
-- ============================================================================

SET search_path = public;

CREATE OR REPLACE FUNCTION public.append_audit_entry(
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
  p_idempotency_key              UUID DEFAULT NULL
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
  -- Fail fast on lock contention instead of hanging the client.
  SET LOCAL lock_timeout = '3s';

  -- Idempotency short-circuit (before taking locks)
  IF p_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_existing_row
      FROM public.audit_logs al
     WHERE al.actor_id = p_actor_id AND al.idempotency_key = p_idempotency_key
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

  -- Per-chain advisory lock (project-scoped if available, else resource-scoped).
  -- Bounded by lock_timeout above — raises 55P03 lock_not_available on contention.
  v_lock_key := hashtextextended(
    COALESCE(p_project_id::text, p_resource_type || ':' || p_resource_id::text),
    0
  );
  PERFORM pg_advisory_xact_lock(v_lock_key);

  -- Validate resource-chain tail
  SELECT al.entry_hash INTO v_current_resource_hash
    FROM public.audit_logs al
   WHERE al.resource_type = p_resource_type AND al.resource_id = p_resource_id
   ORDER BY al.timestamp DESC, al.id DESC
   LIMIT 1;

  IF COALESCE(v_current_resource_hash, '') <> COALESCE(p_expected_resource_prev_hash, '') THEN
    RAISE EXCEPTION 'audit chain conflict: resource tail moved (expected %, found %)',
      COALESCE(p_expected_resource_prev_hash, 'GENESIS'),
      COALESCE(v_current_resource_hash, 'GENESIS')
      USING ERRCODE = 'serialization_failure';
  END IF;

  -- Validate project-chain tail + monotonic timestamp + next sequence
  IF p_project_id IS NOT NULL THEN
    SELECT al.project_chain_entry_hash, al.timestamp
      INTO v_current_project_hash, v_current_project_ts
      FROM public.audit_logs al
     WHERE al.project_id = p_project_id
       AND al.project_chain_entry_hash IS NOT NULL
     ORDER BY al.sequence_number DESC NULLS LAST, al.timestamp DESC, al.id DESC
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

    SELECT COALESCE(MAX(al.sequence_number), 0) + 1 INTO v_next_sequence
      FROM public.audit_logs al
     WHERE al.project_id = p_project_id;
  END IF;

  v_new_id := gen_random_uuid();

  INSERT INTO public.audit_logs (
    id, timestamp, actor_id, action, resource_type, resource_id,
    project_id, institution_id, details, ip_address,
    prev_hash, entry_hash,
    project_chain_prev_hash, project_chain_entry_hash,
    sequence_number, idempotency_key, hardened
  ) VALUES (
    v_new_id, p_timestamp, p_actor_id, p_action, p_resource_type, p_resource_id,
    p_project_id, p_institution_id, COALESCE(p_details, '{}'::jsonb), p_ip_address,
    p_expected_resource_prev_hash, p_resource_entry_hash,
    p_expected_project_prev_hash, p_project_entry_hash,
    v_next_sequence, p_idempotency_key, TRUE
  );

  id                       := v_new_id;
  sequence_number          := v_next_sequence;
  entry_hash               := p_resource_entry_hash;
  project_chain_entry_hash := p_project_entry_hash;
  idempotent_replay        := FALSE;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
