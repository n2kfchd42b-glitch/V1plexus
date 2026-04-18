-- ============================================================================
-- AUDIT TYPE REGISTRY SYNC
--
-- Adds action and resource_type values that the application writes but were
-- absent from the initial seed or the backfill migration, causing FK
-- violations (audit_write_failed) on first use.
--
-- Additive only — ON CONFLICT DO NOTHING makes this safe to re-run.
-- ============================================================================

SET search_path = public;

INSERT INTO public.audit_action_registry (action) VALUES
  -- Dataset: version creation was in the TypeScript type but never seeded
  ('dataset.version.created')
ON CONFLICT (action) DO NOTHING;

-- The resource types below are referenced by writeAuditEntry calls in the
-- TS codebase but were missing from the initial registry, causing every
-- portfolio and approval-request audit write to fail with an FK violation.
INSERT INTO public.audit_resource_registry (resource_type) VALUES
  ('dataset_lineage'),
  ('dataset_approval_request'),
  ('portfolio_certificate'),
  ('portfolio_publication')
ON CONFLICT (resource_type) DO NOTHING;
