-- ============================================================================
-- AUDIT LEDGER INTEGRITY HARDENING
--
-- Adds: monotonic sequence numbers, idempotency keys, atomic-append RPC with
--       per-chain locking, unique constraints (race prevention), UPDATE/DELETE
--       rejection trigger, tightened SELECT RLS, action/resource registries,
--       Merkle root snapshot table.
--
-- Drops: unused `ledger_events` / `ledger_session_keys` (never wired up).
--
-- Idempotent where safe (IF NOT EXISTS / CREATE OR REPLACE).
-- ============================================================================

SET search_path = public;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── 1. Drop the orphaned Ed25519 ledger tables ──────────────────────────────
--     Never integrated; two parallel ledgers caused architectural confusion.
--     Safe: zero references exist in /src.

DROP TABLE IF EXISTS public.ledger_events CASCADE;
DROP TABLE IF EXISTS public.ledger_session_keys CASCADE;

-- ── 2. Registries for action + resource_type (FK-enforced enum) ─────────────

CREATE TABLE IF NOT EXISTS public.audit_action_registry (
  action       TEXT PRIMARY KEY,
  description  TEXT,
  added_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.audit_resource_registry (
  resource_type TEXT PRIMARY KEY,
  description   TEXT,
  added_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.audit_action_registry (action) VALUES
  ('dataset.imported'), ('dataset.deleted'), ('dataset.archived'),
  ('dataset.unarchived'), ('dataset.version.created'),
  ('dataset.version.committed'), ('dataset.branch.created'),
  ('dataset.branch.merged'), ('dataset.rows.dropped'),
  ('dataset.column.recoded'), ('dataset.imputation.mice'),
  ('dataset.duplicates.resolved'), ('dataset.reentry.validated'),
  ('dataset.exploration.created'), ('dataset.approved'),
  ('dataset.approval.requested'), ('dataset.approval.rejected'),
  ('dataset.approval.revision_requested'),
  ('dataset.verification.token_created'),
  ('analysis.run.saved'), ('analysis.run.deleted'),
  ('analysis.run.started'), ('analysis.run.completed'),
  ('analysis.run.failed'), ('analysis.assumption.acknowledged'),
  ('output.checklist.generated'), ('output.methods.generated'),
  ('output.package.generated'),
  ('document.created'), ('document.deleted'), ('document.edited'),
  ('document.generated'), ('document.exported'), ('document.submitted'),
  ('document.approved'), ('document.revision_requested'), ('document.rejected'),
  ('project.created'), ('project.updated'), ('project.archived'),
  ('project.deleted'), ('project.member.added'), ('project.member.removed'),
  ('progress.note'),
  ('auth.login'), ('auth.logout'), ('auth.password.changed')
ON CONFLICT (action) DO NOTHING;

INSERT INTO public.audit_resource_registry (resource_type) VALUES
  ('dataset'), ('dataset_version'), ('dataset_branch'),
  ('dataset_exploration'), ('analysis_run'), ('document'),
  ('project'), ('profile')
ON CONFLICT (resource_type) DO NOTHING;

-- Backfill the registries from any existing audit_logs rows so that the
-- FK constraints added below don't fail on historical actions/types that
-- weren't in the seed list. The registries are still additive-only going
-- forward (application writes must match a registered value).
INSERT INTO public.audit_action_registry (action, description)
SELECT DISTINCT action, 'backfilled from existing audit_logs'
  FROM public.audit_logs
 WHERE action IS NOT NULL
ON CONFLICT (action) DO NOTHING;

INSERT INTO public.audit_resource_registry (resource_type, description)
SELECT DISTINCT resource_type, 'backfilled from existing audit_logs'
  FROM public.audit_logs
 WHERE resource_type IS NOT NULL
ON CONFLICT (resource_type) DO NOTHING;

ALTER TABLE public.audit_action_registry   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_resource_registry ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='audit_action_registry' AND policyname='audit_action_registry_read') THEN
    EXECUTE 'CREATE POLICY "audit_action_registry_read" ON public.audit_action_registry FOR SELECT TO authenticated USING (true)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='audit_resource_registry' AND policyname='audit_resource_registry_read') THEN
    EXECUTE 'CREATE POLICY "audit_resource_registry_read" ON public.audit_resource_registry FOR SELECT TO authenticated USING (true)';
  END IF;
END $$;

-- ── 3. Add integrity columns to audit_logs ──────────────────────────────────

ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS sequence_number  BIGINT,
  ADD COLUMN IF NOT EXISTS idempotency_key  UUID,
  ADD COLUMN IF NOT EXISTS hardened         BOOLEAN NOT NULL DEFAULT FALSE;
-- `hardened` separates post-migration rows (written via append_audit_entry,
-- fully constrained) from historical rows (pre-migration, which may contain
-- chain-fork duplicates from the very race conditions this migration fixes).
-- New uniqueness rules below apply only to hardened=TRUE rows.

-- Backfill sequence_number for existing rows (per project, ordered by timestamp)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.audit_logs WHERE sequence_number IS NULL LIMIT 1) THEN
    WITH numbered AS (
      SELECT id,
             ROW_NUMBER() OVER (PARTITION BY project_id ORDER BY timestamp ASC, id ASC) AS seq
      FROM public.audit_logs
      WHERE project_id IS NOT NULL
    )
    UPDATE public.audit_logs a
       SET sequence_number = n.seq
      FROM numbered n
     WHERE a.id = n.id AND a.sequence_number IS NULL;
  END IF;
END $$;

-- ── 4. FK + unique constraints (race & duplicate protection) ────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'audit_logs_action_fk'
  ) THEN
    ALTER TABLE public.audit_logs
      ADD CONSTRAINT audit_logs_action_fk
      FOREIGN KEY (action) REFERENCES public.audit_action_registry(action);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'audit_logs_resource_type_fk'
  ) THEN
    ALTER TABLE public.audit_logs
      ADD CONSTRAINT audit_logs_resource_type_fk
      FOREIGN KEY (resource_type) REFERENCES public.audit_resource_registry(resource_type);
  END IF;
END $$;

-- Uniqueness applies to hardened rows only (historical rows are exempt;
-- they were written before these constraints and may contain the very
-- race-condition duplicates this migration is designed to prevent going forward).

-- One child per resource-chain parent (prevents concurrent fork writes)
CREATE UNIQUE INDEX IF NOT EXISTS ux_audit_resource_prev
  ON public.audit_logs (resource_type, resource_id, prev_hash)
  WHERE hardened AND prev_hash IS NOT NULL;

-- One child per project-chain parent
CREATE UNIQUE INDEX IF NOT EXISTS ux_audit_project_chain_prev
  ON public.audit_logs (project_id, project_chain_prev_hash)
  WHERE hardened AND project_id IS NOT NULL AND project_chain_prev_hash IS NOT NULL;

-- Exactly one genesis per resource chain
CREATE UNIQUE INDEX IF NOT EXISTS ux_audit_resource_genesis
  ON public.audit_logs (resource_type, resource_id)
  WHERE hardened AND prev_hash IS NULL;

-- Exactly one genesis per project chain
CREATE UNIQUE INDEX IF NOT EXISTS ux_audit_project_chain_genesis
  ON public.audit_logs (project_id)
  WHERE hardened AND project_id IS NOT NULL
    AND project_chain_entry_hash IS NOT NULL
    AND project_chain_prev_hash IS NULL;

-- Monotonic sequence per project
CREATE UNIQUE INDEX IF NOT EXISTS ux_audit_project_sequence
  ON public.audit_logs (project_id, sequence_number)
  WHERE hardened AND project_id IS NOT NULL AND sequence_number IS NOT NULL;

-- Idempotency: same actor+key returns same row on replay
CREATE UNIQUE INDEX IF NOT EXISTS ux_audit_idempotency
  ON public.audit_logs (actor_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- Ensure entry_hash is unique among hardened rows (defense-in-depth)
CREATE UNIQUE INDEX IF NOT EXISTS ux_audit_entry_hash
  ON public.audit_logs (entry_hash)
  WHERE hardened AND entry_hash IS NOT NULL;

-- ── 5. UPDATE / DELETE rejection trigger (append-only enforcement) ──────────

CREATE OR REPLACE FUNCTION public.audit_logs_reject_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only — % is forbidden', TG_OP
    USING ERRCODE = 'insufficient_privilege';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_logs_no_update ON public.audit_logs;
DROP TRIGGER IF EXISTS trg_audit_logs_no_delete ON public.audit_logs;

CREATE TRIGGER trg_audit_logs_no_update
  BEFORE UPDATE ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.audit_logs_reject_mutation();

CREATE TRIGGER trg_audit_logs_no_delete
  BEFORE DELETE ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.audit_logs_reject_mutation();

-- ── 6. Tightened SELECT RLS (fix cross-project actor leak) ──────────────────
--     Old policy allowed `actor_id = auth.uid()` globally, letting users read
--     entries in projects they were removed from. New policy restricts the
--     actor exemption to profile-scoped or project-less entries.

DROP POLICY IF EXISTS "Users can read project audit logs" ON public.audit_logs;

CREATE POLICY "Users can read project audit logs" ON public.audit_logs
  FOR SELECT TO authenticated USING (
    project_id IN (
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
      UNION SELECT id FROM projects WHERE owner_id = auth.uid()
    )
    OR (
      actor_id = auth.uid()
      AND (resource_type = 'profile' OR project_id IS NULL)
    )
  );

-- ── 7. Atomic append RPC ─────────────────────────────────────────────────────
--     Serializes writes per (project|resource) chain via advisory lock,
--     validates prev-hash tail matches, enforces monotonic timestamps,
--     assigns next sequence_number, and honours idempotency_key replay.
--     Hash computation stays in the caller (JS) to preserve canonical format
--     compatibility with existing entries; the RPC verifies consistency.

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

REVOKE ALL ON FUNCTION public.append_audit_entry(
  UUID, TEXT, TEXT, UUID, UUID, UUID, JSONB, INET, TIMESTAMPTZ,
  TEXT, TEXT, TEXT, TEXT, UUID
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.append_audit_entry(
  UUID, TEXT, TEXT, UUID, UUID, UUID, JSONB, INET, TIMESTAMPTZ,
  TEXT, TEXT, TEXT, TEXT, UUID
) TO service_role;

-- ── 8. Merkle root snapshots (external-commitment layer) ────────────────────

CREATE TABLE IF NOT EXISTS public.audit_merkle_roots (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id        UUID NOT NULL REFERENCES public.projects(id) ON DELETE RESTRICT,
  anchor_timestamp  TIMESTAMPTZ NOT NULL DEFAULT now(),
  first_sequence    BIGINT NOT NULL,
  last_sequence     BIGINT NOT NULL,
  entry_count       INTEGER NOT NULL,
  root_hash         TEXT NOT NULL,
  algorithm         TEXT NOT NULL DEFAULT 'sha256-merkle-v1',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT audit_merkle_roots_seq_check CHECK (last_sequence >= first_sequence)
);

CREATE INDEX IF NOT EXISTS idx_audit_merkle_project
  ON public.audit_merkle_roots (project_id, anchor_timestamp DESC);

ALTER TABLE public.audit_merkle_roots ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='audit_merkle_roots' AND policyname='audit_merkle_roots_read') THEN
    EXECUTE $policy$
      CREATE POLICY "audit_merkle_roots_read" ON public.audit_merkle_roots
        FOR SELECT TO authenticated USING (
          project_id IN (
            SELECT project_id FROM project_members WHERE user_id = auth.uid()
            UNION SELECT id FROM projects WHERE owner_id = auth.uid()
          )
        )
    $policy$;
  END IF;
END $$;

-- Append-only for the snapshot table too
CREATE OR REPLACE FUNCTION public.audit_merkle_roots_reject_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_merkle_roots is append-only — % is forbidden', TG_OP
    USING ERRCODE = 'insufficient_privilege';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_merkle_no_update ON public.audit_merkle_roots;
DROP TRIGGER IF EXISTS trg_audit_merkle_no_delete ON public.audit_merkle_roots;

CREATE TRIGGER trg_audit_merkle_no_update
  BEFORE UPDATE ON public.audit_merkle_roots
  FOR EACH ROW EXECUTE FUNCTION public.audit_merkle_roots_reject_mutation();

CREATE TRIGGER trg_audit_merkle_no_delete
  BEFORE DELETE ON public.audit_merkle_roots
  FOR EACH ROW EXECUTE FUNCTION public.audit_merkle_roots_reject_mutation();

-- Build a Merkle root over [first_seq, last_seq] for a project.
-- Pairwise SHA-256; duplicates the last leaf when an odd count appears.
CREATE OR REPLACE FUNCTION public.compute_audit_merkle_root(
  p_project_id    UUID,
  p_first_seq     BIGINT,
  p_last_seq      BIGINT
) RETURNS TABLE (
  root_hash    TEXT,
  entry_count  INTEGER,
  first_seq    BIGINT,
  last_seq     BIGINT
) AS $$
DECLARE
  v_level  TEXT[];
  v_next   TEXT[];
  v_i      INTEGER;
  v_len    INTEGER;
  v_left   TEXT;
  v_right  TEXT;
BEGIN
  SELECT array_agg(entry_hash ORDER BY sequence_number ASC)
    INTO v_level
    FROM public.audit_logs
   WHERE project_id = p_project_id
     AND sequence_number BETWEEN p_first_seq AND p_last_seq
     AND project_chain_entry_hash IS NOT NULL;

  IF v_level IS NULL OR array_length(v_level, 1) = 0 THEN
    root_hash   := NULL;
    entry_count := 0;
    first_seq   := p_first_seq;
    last_seq    := p_last_seq;
    RETURN NEXT;
    RETURN;
  END IF;

  entry_count := array_length(v_level, 1);

  WHILE array_length(v_level, 1) > 1 LOOP
    v_next := ARRAY[]::TEXT[];
    v_len  := array_length(v_level, 1);
    v_i    := 1;
    WHILE v_i <= v_len LOOP
      v_left  := v_level[v_i];
      v_right := CASE WHEN v_i + 1 <= v_len THEN v_level[v_i + 1] ELSE v_level[v_i] END;
      v_next  := v_next || encode(digest(v_left || v_right, 'sha256'), 'hex');
      v_i     := v_i + 2;
    END LOOP;
    v_level := v_next;
  END LOOP;

  root_hash := v_level[1];
  first_seq := p_first_seq;
  last_seq  := p_last_seq;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.compute_audit_merkle_root(UUID, BIGINT, BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.compute_audit_merkle_root(UUID, BIGINT, BIGINT) TO authenticated, service_role;

-- Snapshot the current tail as a new Merkle root anchor (service role only).
CREATE OR REPLACE FUNCTION public.snapshot_audit_merkle_root(
  p_project_id UUID
) RETURNS UUID AS $$
DECLARE
  v_last_anchor  BIGINT;
  v_first_seq    BIGINT;
  v_last_seq     BIGINT;
  v_result       RECORD;
  v_id           UUID;
BEGIN
  SELECT COALESCE(MAX(last_sequence), 0) INTO v_last_anchor
    FROM public.audit_merkle_roots
   WHERE project_id = p_project_id;

  SELECT MIN(sequence_number), MAX(sequence_number) INTO v_first_seq, v_last_seq
    FROM public.audit_logs
   WHERE project_id = p_project_id
     AND sequence_number > v_last_anchor
     AND project_chain_entry_hash IS NOT NULL;

  IF v_first_seq IS NULL THEN
    RETURN NULL; -- nothing new to anchor
  END IF;

  SELECT * INTO v_result
    FROM public.compute_audit_merkle_root(p_project_id, v_first_seq, v_last_seq);

  IF v_result.root_hash IS NULL THEN
    RETURN NULL;
  END IF;

  v_id := gen_random_uuid();
  INSERT INTO public.audit_merkle_roots (
    id, project_id, first_sequence, last_sequence, entry_count, root_hash
  ) VALUES (
    v_id, p_project_id, v_result.first_seq, v_result.last_seq,
    v_result.entry_count, v_result.root_hash
  );

  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.snapshot_audit_merkle_root(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.snapshot_audit_merkle_root(UUID) TO service_role;
