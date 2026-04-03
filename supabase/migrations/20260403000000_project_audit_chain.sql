-- ════════════════════════════════════════════════════════════
-- PROJECT-SCOPED AUDIT CHAIN
--
-- Creates audit_logs with project chain columns if it doesn't
-- exist yet. If it already exists, safely adds the two new
-- columns. Either path is idempotent.
-- ════════════════════════════════════════════════════════════

SET search_path = public;

-- ── Create table (first-time setup) ──────────────────────────
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id                        UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  timestamp                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor_id                  UUID REFERENCES public.profiles(id),
  action                    TEXT NOT NULL,
  resource_type             TEXT NOT NULL,
  resource_id               UUID NOT NULL,
  project_id                UUID,
  institution_id            UUID,
  details                   JSONB NOT NULL DEFAULT '{}',
  ip_address                INET,
  prev_hash                 TEXT,
  entry_hash                TEXT NOT NULL,
  -- Project-scoped chain (added in this migration)
  project_chain_prev_hash   TEXT,
  project_chain_entry_hash  TEXT
);

-- ── Add columns to pre-existing installs ─────────────────────
ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS project_chain_prev_hash  TEXT,
  ADD COLUMN IF NOT EXISTS project_chain_entry_hash TEXT;

-- ── Indexes ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_audit_actor
  ON public.audit_logs (actor_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_audit_resource
  ON public.audit_logs (resource_type, resource_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_audit_project
  ON public.audit_logs (project_id, timestamp DESC)
  WHERE project_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_institution
  ON public.audit_logs (institution_id, timestamp DESC)
  WHERE institution_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_action
  ON public.audit_logs (action, timestamp DESC);

-- Project chain tail lookup
CREATE INDEX IF NOT EXISTS idx_audit_project_chain_tail
  ON public.audit_logs (project_id, timestamp DESC)
  WHERE project_id IS NOT NULL
    AND project_chain_entry_hash IS NOT NULL;

-- ── RLS ───────────────────────────────────────────────────────
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'audit_logs'
      AND policyname = 'Users can read project audit logs'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Users can read project audit logs" ON public.audit_logs
        FOR SELECT TO authenticated USING (
          project_id IN (
            SELECT project_id FROM project_members WHERE user_id = auth.uid()
            UNION SELECT id FROM projects WHERE owner_id = auth.uid()
          )
          OR actor_id = auth.uid()
        )
    $policy$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'audit_logs'
      AND policyname = 'Service role can insert audit logs'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Service role can insert audit logs" ON public.audit_logs
        FOR INSERT TO service_role WITH CHECK (true)
    $policy$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'audit_logs'
      AND policyname = 'Authenticated users can insert their own audit logs'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Authenticated users can insert their own audit logs" ON public.audit_logs
        FOR INSERT TO authenticated WITH CHECK (actor_id = auth.uid())
    $policy$;
  END IF;
END $$;
