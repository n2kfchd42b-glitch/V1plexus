-- ════════════════════════════════════════
-- PLEXUS — Audit registry sync for the institution feature surface
--
-- PRs A–F introduced ~20 new AuditAction enum members and 5 new ResourceType
-- members in TypeScript, but only PR G's two values were inserted into
-- audit_action_registry. With the FK constraints on audit_logs.{action,
-- resource_type} from 20260416000000_audit_ledger_integrity.sql, every
-- writeAuditEntry call from these PRs is silently rejected — the helper
-- catches the FK violation and returns {success:false}, but every call site
-- uses `void writeAuditEntry(...)` so the failures are invisible.
--
-- This migration is additive-only (ON CONFLICT DO NOTHING) and safe to re-run.
-- ════════════════════════════════════════

SET search_path = public;

INSERT INTO public.audit_action_registry (action) VALUES
  -- PR A: provisioning + inquiry conversion (PR D registered these via TS only)
  ('institution.provisioned'),
  ('institution.inquiry.converted'),
  ('institution.admin.updated'),
  -- PR B: individual ↔ institution linking
  ('institution.link.requested'),
  ('institution.link.auto_approved'),
  ('institution.link.approved'),
  ('institution.link.declined'),
  -- PR F: programmes, cohorts, roster, enrollments
  ('institution.programme.created'),
  ('institution.programme.updated'),
  ('institution.programme.deactivated'),
  ('institution.cohort.created'),
  ('institution.cohort.updated'),
  ('institution.roster.uploaded'),
  ('institution.roster.entry.updated'),
  ('institution.roster.entry.deleted'),
  ('institution.roster.entry.invalidated'),
  ('institution.enrollment.created'),
  ('institution.enrollment.updated'),
  ('institution.enrollment.withdrawn'),
  ('institution.roster.claimed')
ON CONFLICT (action) DO NOTHING;

INSERT INTO public.audit_resource_registry (resource_type) VALUES
  -- PR A/B/D/E: the catch-all institution resource (provisioning, branding,
  -- tier change, link.* events all use resource_type='institution').
  ('institution'),
  -- PR F: per-row resource types
  ('institution_programme'),
  ('institution_cohort'),
  ('institution_roster_entry'),
  ('institution_enrollment')
ON CONFLICT (resource_type) DO NOTHING;
