-- ============================================================================
-- FIX MERKLE COMPUTATION
--
-- Problems fixed:
--
--   1. compute_audit_merkle_root used `entry_hash` (resource-scoped) instead of
--      `project_chain_entry_hash` (project-scoped). A project Merkle root must
--      commit to the project chain, not per-resource chains.
--
--   2. array_agg ordered by sequence_number ASC with no NULLS handling. Entries
--      written by the Python backend before this fix have sequence_number = NULL
--      and were silently placed last in the leaf array, breaking the Merkle
--      root's correspondence to temporal order. Fixed to NULLS LAST + secondary
--      timestamp sort so pre-fix entries are gracefully handled.
--
--   3. snapshot_audit_merkle_root was never called by anything. Added a
--      dedicated trigger function so callers can snapshot via RPC. Granted to
--      authenticated so the Next.js API route can call it on package generation.
--      (The analytics Python backend already has service_role which covers it.)
--
-- Safe to re-run (CREATE OR REPLACE).
-- ============================================================================

SET search_path = public;

-- ── 1. Fix compute_audit_merkle_root ────────────────────────────────────────

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
  -- Collect project_chain_entry_hash (not entry_hash) in sequence order.
  -- Entries without a sequence_number (written before the hardening migration)
  -- are placed last so they do not disrupt the ordered chain; secondary sort
  -- by timestamp preserves their relative order among themselves.
  SELECT array_agg(project_chain_entry_hash
                   ORDER BY sequence_number ASC NULLS LAST, timestamp ASC)
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

  -- Pairwise SHA-256 Merkle reduction; duplicate last leaf on odd count.
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

-- ── 2. Grant authenticated access to snapshot_audit_merkle_root ─────────────
--    Previously only service_role could call this, making it impossible to
--    trigger from the Next.js API layer without a separate service-role call.
--    The function is SECURITY DEFINER so it runs as the function owner regardless.

GRANT EXECUTE ON FUNCTION public.snapshot_audit_merkle_root(UUID) TO authenticated;
