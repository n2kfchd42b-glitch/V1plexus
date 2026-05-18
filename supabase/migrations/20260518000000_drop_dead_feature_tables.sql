-- ============================================================
-- Drop tables from removed features:
--   - Institutional Intelligence (grants, knowledge base)
--   - Research Network & Compliance
--   - Institutional Policies & Members
-- These were all stub/institutional features removed in the
-- supervisor-student platform pivot.
-- ============================================================

-- ── Institutional Intelligence ────────────────────────────────
DROP TABLE IF EXISTS research_metrics              CASCADE;
DROP TABLE IF EXISTS knowledge_base_entries        CASCADE;
DROP TABLE IF EXISTS grant_reports                 CASCADE;
DROP TABLE IF EXISTS grant_projects                CASCADE;
DROP TABLE IF EXISTS grants                        CASCADE;

-- ── Research Network & Compliance ────────────────────────────
DROP TABLE IF EXISTS data_management_plans         CASCADE;
DROP TABLE IF EXISTS consent_withdrawals           CASCADE;
DROP TABLE IF EXISTS consent_records               CASCADE;
DROP TABLE IF EXISTS consent_forms                 CASCADE;
DROP TABLE IF EXISTS data_retention_policies       CASCADE;
DROP TABLE IF EXISTS compliance_checks             CASCADE;
DROP TABLE IF EXISTS compliance_profiles           CASCADE;
DROP TABLE IF EXISTS cross_institution_invites     CASCADE;
DROP TABLE IF EXISTS dataset_access_requests       CASCADE;
DROP TABLE IF EXISTS network_datasets              CASCADE;

-- ── Institutional Policies & Members ─────────────────────────
DROP TABLE IF EXISTS public.researcher_departures              CASCADE;
DROP TABLE IF EXISTS public.institutional_compliance_events    CASCADE;
DROP TABLE IF EXISTS public.supervisor_signing_authorisations  CASCADE;
DROP TABLE IF EXISTS public.institutional_policies             CASCADE;
