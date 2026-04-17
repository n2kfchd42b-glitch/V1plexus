-- ============================================================================
-- AUDIT REGISTRY BACKFILL
--
-- The 20260416000000_audit_ledger_integrity migration added FK constraints
-- from audit_logs.action -> audit_action_registry and audit_logs.resource_type
-- -> audit_resource_registry. The seeded registries in that migration did not
-- cover every action/resource_type the application actually writes, so newly-
-- emitted entries (e.g. project.share_link.generated, portfolio.*) were
-- failing with an FK violation and surfacing as `audit_write_failed` on the
-- client. Add the missing values so the Timeline feed starts recording again.
--
-- Additive only; safe to re-run.
-- ============================================================================

SET search_path = public;

INSERT INTO public.audit_action_registry (action) VALUES
  -- Analysis
  ('analysis.reasoning_added'),
  -- Project-scoped
  ('project.share_link.generated'),
  ('project.share_link.revoked'),
  ('project.member.invited'),
  -- Dataset re-entry flow
  ('dataset.reentry.initiated'),
  ('dataset.reentry.discrepancy.resolved'),
  -- Profile & portfolio
  ('profile.updated'),
  ('portfolio.certificate.added'),
  ('portfolio.publication.added'),
  -- Document versioning
  ('document.version_saved'),
  ('document.version_restored')
ON CONFLICT (action) DO NOTHING;

INSERT INTO public.audit_resource_registry (resource_type) VALUES
  ('dataset_approval_request'),
  ('dataset_lineage'),
  ('portfolio_certificate'),
  ('portfolio_publication')
ON CONFLICT (resource_type) DO NOTHING;
