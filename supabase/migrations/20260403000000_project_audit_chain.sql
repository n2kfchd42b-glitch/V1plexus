-- ════════════════════════════════════════════════════════════
-- PROJECT-SCOPED AUDIT CHAIN
--
-- Adds two columns to audit_logs that form an independent
-- SHA-256 hash chain per project, ordered by timestamp.
-- Each project gets its own genesis block (project.created)
-- and every subsequent entry links back to the previous one.
--
-- This runs entirely additive — existing rows remain valid.
-- ════════════════════════════════════════════════════════════

SET search_path = public;

ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS project_chain_prev_hash  TEXT,
  ADD COLUMN IF NOT EXISTS project_chain_entry_hash TEXT;

-- Efficient lookup of the most-recent project chain tail
CREATE INDEX IF NOT EXISTS idx_audit_project_chain_tail
  ON public.audit_logs (project_id, timestamp DESC)
  WHERE project_id IS NOT NULL
    AND project_chain_entry_hash IS NOT NULL;
