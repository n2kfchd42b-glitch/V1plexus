-- Fix missing ON DELETE rules on every REFERENCES profiles(id) FK.
--
-- Root cause: Supabase's "Delete user" button deletes from auth.users,
-- which cascades to profiles (via profiles.id ON DELETE CASCADE), but
-- every other table that references profiles(id) had no ON DELETE rule,
-- defaulting to RESTRICT — blocking the entire deletion chain.
--
-- Strategy:
--   CASCADE  — structural rows (the record belongs to / is the user:
--              memberships, project members, notifications, assignments…)
--   SET NULL — audit/metadata cols (created_by, invited_by, actor_id…)
--              where the record should survive after the user is deleted.
--   DROP NOT NULL + SET NULL — for NOT NULL audit cols that must be
--              nulled without destroying the parent record.

-- ─── workspaces ───────────────────────────────────────────────────────────────
ALTER TABLE workspaces
  DROP CONSTRAINT IF EXISTS workspaces_owner_id_fkey,
  ADD CONSTRAINT workspaces_owner_id_fkey
    FOREIGN KEY (owner_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- ─── workspace_memberships ────────────────────────────────────────────────────
ALTER TABLE workspace_memberships
  DROP CONSTRAINT IF EXISTS workspace_memberships_supervisor_id_fkey,
  ADD CONSTRAINT workspace_memberships_supervisor_id_fkey
    FOREIGN KEY (supervisor_id) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE workspace_memberships
  DROP CONSTRAINT IF EXISTS workspace_memberships_invited_by_fkey,
  ADD CONSTRAINT workspace_memberships_invited_by_fkey
    FOREIGN KEY (invited_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- ─── workspace_invitations ────────────────────────────────────────────────────
ALTER TABLE workspace_invitations
  DROP CONSTRAINT IF EXISTS workspace_invitations_supervisor_id_fkey,
  ADD CONSTRAINT workspace_invitations_supervisor_id_fkey
    FOREIGN KEY (supervisor_id) REFERENCES profiles(id) ON DELETE SET NULL;

-- invited_by is NOT NULL — drop the constraint so SET NULL can work
ALTER TABLE workspace_invitations
  ALTER COLUMN invited_by DROP NOT NULL;
ALTER TABLE workspace_invitations
  DROP CONSTRAINT IF EXISTS workspace_invitations_invited_by_fkey,
  ADD CONSTRAINT workspace_invitations_invited_by_fkey
    FOREIGN KEY (invited_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- ─── project_invitations ──────────────────────────────────────────────────────
ALTER TABLE project_invitations
  ALTER COLUMN invited_by DROP NOT NULL;
ALTER TABLE project_invitations
  DROP CONSTRAINT IF EXISTS project_invitations_invited_by_fkey,
  ADD CONSTRAINT project_invitations_invited_by_fkey
    FOREIGN KEY (invited_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- ─── project_members ──────────────────────────────────────────────────────────
ALTER TABLE project_members
  DROP CONSTRAINT IF EXISTS project_members_user_id_fkey,
  ADD CONSTRAINT project_members_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE project_members
  DROP CONSTRAINT IF EXISTS project_members_invited_by_fkey,
  ADD CONSTRAINT project_members_invited_by_fkey
    FOREIGN KEY (invited_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- ─── projects ─────────────────────────────────────────────────────────────────
ALTER TABLE projects
  DROP CONSTRAINT IF EXISTS projects_owner_id_fkey,
  ADD CONSTRAINT projects_owner_id_fkey
    FOREIGN KEY (owner_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- ─── supervisor_assignments ───────────────────────────────────────────────────
ALTER TABLE supervisor_assignments
  DROP CONSTRAINT IF EXISTS supervisor_assignments_supervisor_id_fkey,
  ADD CONSTRAINT supervisor_assignments_supervisor_id_fkey
    FOREIGN KEY (supervisor_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE supervisor_assignments
  DROP CONSTRAINT IF EXISTS supervisor_assignments_student_id_fkey,
  ADD CONSTRAINT supervisor_assignments_student_id_fkey
    FOREIGN KEY (student_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE supervisor_assignments
  DROP CONSTRAINT IF EXISTS supervisor_assignments_assigned_by_fkey,
  ADD CONSTRAINT supervisor_assignments_assigned_by_fkey
    FOREIGN KEY (assigned_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- ─── user_role_assignments ────────────────────────────────────────────────────
ALTER TABLE user_role_assignments
  DROP CONSTRAINT IF EXISTS user_role_assignments_granted_by_fkey,
  ADD CONSTRAINT user_role_assignments_granted_by_fkey
    FOREIGN KEY (granted_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- ─── departments ──────────────────────────────────────────────────────────────
ALTER TABLE departments
  DROP CONSTRAINT IF EXISTS departments_head_id_fkey,
  ADD CONSTRAINT departments_head_id_fkey
    FOREIGN KEY (head_id) REFERENCES profiles(id) ON DELETE SET NULL;

-- ─── institution_members ──────────────────────────────────────────────────────
ALTER TABLE institution_members
  DROP CONSTRAINT IF EXISTS institution_members_user_id_fkey,
  ADD CONSTRAINT institution_members_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- ─── notifications / push ─────────────────────────────────────────────────────
ALTER TABLE notifications
  DROP CONSTRAINT IF EXISTS notifications_user_id_fkey,
  ADD CONSTRAINT notifications_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE push_subscriptions
  DROP CONSTRAINT IF EXISTS push_subscriptions_user_id_fkey,
  ADD CONSTRAINT push_subscriptions_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- ─── credential_uploads ───────────────────────────────────────────────────────
ALTER TABLE credential_uploads
  DROP CONSTRAINT IF EXISTS credential_uploads_user_id_fkey,
  ADD CONSTRAINT credential_uploads_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- ─── ai usage log ─────────────────────────────────────────────────────────────
ALTER TABLE ai_usage_log
  DROP CONSTRAINT IF EXISTS ai_usage_log_user_id_fkey,
  ADD CONSTRAINT ai_usage_log_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- ─── compliance_checks ────────────────────────────────────────────────────────
ALTER TABLE compliance_checks
  DROP CONSTRAINT IF EXISTS compliance_checks_profile_id_fkey,
  ADD CONSTRAINT compliance_checks_profile_id_fkey
    FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- ─── documents ────────────────────────────────────────────────────────────────
ALTER TABLE documents
  DROP CONSTRAINT IF EXISTS documents_locked_by_fkey,
  ADD CONSTRAINT documents_locked_by_fkey
    FOREIGN KEY (locked_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- created_by is NOT NULL — relax so the document survives user deletion
ALTER TABLE documents
  ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE documents
  DROP CONSTRAINT IF EXISTS documents_created_by_fkey,
  ADD CONSTRAINT documents_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- ─── document_comments ────────────────────────────────────────────────────────
ALTER TABLE document_comments
  ALTER COLUMN author_id DROP NOT NULL;
ALTER TABLE document_comments
  DROP CONSTRAINT IF EXISTS document_comments_author_id_fkey,
  ADD CONSTRAINT document_comments_author_id_fkey
    FOREIGN KEY (author_id) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE document_comments
  DROP CONSTRAINT IF EXISTS document_comments_resolved_by_fkey,
  ADD CONSTRAINT document_comments_resolved_by_fkey
    FOREIGN KEY (resolved_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- ─── document_versions ────────────────────────────────────────────────────────
ALTER TABLE document_versions
  DROP CONSTRAINT IF EXISTS document_versions_created_by_fkey,
  ADD CONSTRAINT document_versions_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- ─── document_exports ─────────────────────────────────────────────────────────
ALTER TABLE document_exports
  DROP CONSTRAINT IF EXISTS document_exports_exported_by_fkey,
  ADD CONSTRAINT document_exports_exported_by_fkey
    FOREIGN KEY (exported_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- ─── ethics ───────────────────────────────────────────────────────────────────
ALTER TABLE ethics_applications
  DROP CONSTRAINT IF EXISTS ethics_applications_created_by_fkey,
  ADD CONSTRAINT ethics_applications_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE ethics_documents
  DROP CONSTRAINT IF EXISTS ethics_documents_uploaded_by_fkey,
  ADD CONSTRAINT ethics_documents_uploaded_by_fkey
    FOREIGN KEY (uploaded_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE ethics_amendments
  DROP CONSTRAINT IF EXISTS ethics_amendments_created_by_fkey,
  ADD CONSTRAINT ethics_amendments_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- ─── review_comments ──────────────────────────────────────────────────────────
ALTER TABLE review_comments
  ALTER COLUMN author_id DROP NOT NULL;
ALTER TABLE review_comments
  DROP CONSTRAINT IF EXISTS review_comments_author_id_fkey,
  ADD CONSTRAINT review_comments_author_id_fkey
    FOREIGN KEY (author_id) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE review_comments
  DROP CONSTRAINT IF EXISTS review_comments_resolved_by_fkey,
  ADD CONSTRAINT review_comments_resolved_by_fkey
    FOREIGN KEY (resolved_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- ─── review_requests ──────────────────────────────────────────────────────────
ALTER TABLE review_requests
  ALTER COLUMN requested_by DROP NOT NULL;
ALTER TABLE review_requests
  DROP CONSTRAINT IF EXISTS review_requests_requested_by_fkey,
  ADD CONSTRAINT review_requests_requested_by_fkey
    FOREIGN KEY (requested_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE review_requests
  ALTER COLUMN assigned_to DROP NOT NULL;
ALTER TABLE review_requests
  DROP CONSTRAINT IF EXISTS review_requests_assigned_to_fkey,
  ADD CONSTRAINT review_requests_assigned_to_fkey
    FOREIGN KEY (assigned_to) REFERENCES profiles(id) ON DELETE SET NULL;

-- ─── audit_logs ───────────────────────────────────────────────────────────────
ALTER TABLE audit_logs
  DROP CONSTRAINT IF EXISTS audit_logs_actor_id_fkey,
  ADD CONSTRAINT audit_logs_actor_id_fkey
    FOREIGN KEY (actor_id) REFERENCES profiles(id) ON DELETE SET NULL;

-- ─── datasets ─────────────────────────────────────────────────────────────────
ALTER TABLE datasets
  DROP CONSTRAINT IF EXISTS datasets_uploaded_by_fkey,
  ADD CONSTRAINT datasets_uploaded_by_fkey
    FOREIGN KEY (uploaded_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE dataset_versions
  DROP CONSTRAINT IF EXISTS dataset_versions_created_by_fkey,
  ADD CONSTRAINT dataset_versions_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE dataset_branches
  DROP CONSTRAINT IF EXISTS dataset_branches_created_by_fkey,
  ADD CONSTRAINT dataset_branches_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE dataset_explorations
  DROP CONSTRAINT IF EXISTS dataset_explorations_created_by_fkey,
  ADD CONSTRAINT dataset_explorations_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE dataset_publications
  DROP CONSTRAINT IF EXISTS dataset_publications_created_by_fkey,
  ADD CONSTRAINT dataset_publications_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE dataset_access_requests
  ALTER COLUMN requester_id DROP NOT NULL;
ALTER TABLE dataset_access_requests
  DROP CONSTRAINT IF EXISTS dataset_access_requests_requester_id_fkey,
  ADD CONSTRAINT dataset_access_requests_requester_id_fkey
    FOREIGN KEY (requester_id) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE dataset_access_requests
  DROP CONSTRAINT IF EXISTS dataset_access_requests_reviewed_by_fkey,
  ADD CONSTRAINT dataset_access_requests_reviewed_by_fkey
    FOREIGN KEY (reviewed_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- ─── data quality ─────────────────────────────────────────────────────────────
ALTER TABLE data_quality_rules
  DROP CONSTRAINT IF EXISTS data_quality_rules_created_by_fkey,
  ADD CONSTRAINT data_quality_rules_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE data_quality_results
  DROP CONSTRAINT IF EXISTS data_quality_results_resolved_by_fkey,
  ADD CONSTRAINT data_quality_results_resolved_by_fkey
    FOREIGN KEY (resolved_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- ─── analysis ─────────────────────────────────────────────────────────────────
ALTER TABLE analysis_runs
  DROP CONSTRAINT IF EXISTS analysis_runs_created_by_fkey,
  ADD CONSTRAINT analysis_runs_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- ─── project_milestones / citations / messages ───────────────────────────────
ALTER TABLE project_milestones
  DROP CONSTRAINT IF EXISTS project_milestones_created_by_fkey,
  ADD CONSTRAINT project_milestones_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE project_citations
  DROP CONSTRAINT IF EXISTS project_citations_created_by_fkey,
  ADD CONSTRAINT project_citations_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE project_messages
  ALTER COLUMN sender_id DROP NOT NULL;
ALTER TABLE project_messages
  DROP CONSTRAINT IF EXISTS project_messages_sender_id_fkey,
  ADD CONSTRAINT project_messages_sender_id_fkey
    FOREIGN KEY (sender_id) REFERENCES profiles(id) ON DELETE SET NULL;

-- ─── thesis ───────────────────────────────────────────────────────────────────
ALTER TABLE thesis_committees
  DROP CONSTRAINT IF EXISTS thesis_committees_user_id_fkey,
  ADD CONSTRAINT thesis_committees_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE thesis_committees
  DROP CONSTRAINT IF EXISTS thesis_committees_invited_by_fkey,
  ADD CONSTRAINT thesis_committees_invited_by_fkey
    FOREIGN KEY (invited_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE thesis_chapters
  DROP CONSTRAINT IF EXISTS thesis_chapters_approved_by_fkey,
  ADD CONSTRAINT thesis_chapters_approved_by_fkey
    FOREIGN KEY (approved_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- ─── grants ───────────────────────────────────────────────────────────────────
ALTER TABLE grants
  DROP CONSTRAINT IF EXISTS grants_pi_id_fkey,
  ADD CONSTRAINT grants_pi_id_fkey
    FOREIGN KEY (pi_id) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE grants
  DROP CONSTRAINT IF EXISTS grants_created_by_fkey,
  ADD CONSTRAINT grants_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- ─── consent ──────────────────────────────────────────────────────────────────
ALTER TABLE consent_forms
  DROP CONSTRAINT IF EXISTS consent_forms_approved_by_fkey,
  ADD CONSTRAINT consent_forms_approved_by_fkey
    FOREIGN KEY (approved_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE consent_forms
  DROP CONSTRAINT IF EXISTS consent_forms_created_by_fkey,
  ADD CONSTRAINT consent_forms_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE consent_records
  DROP CONSTRAINT IF EXISTS consent_records_collected_by_fkey,
  ADD CONSTRAINT consent_records_collected_by_fkey
    FOREIGN KEY (collected_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE consent_withdrawals
  DROP CONSTRAINT IF EXISTS consent_withdrawals_action_by_fkey,
  ADD CONSTRAINT consent_withdrawals_action_by_fkey
    FOREIGN KEY (action_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- ─── data_management_plans ────────────────────────────────────────────────────
ALTER TABLE data_management_plans
  DROP CONSTRAINT IF EXISTS data_management_plans_created_by_fkey,
  ADD CONSTRAINT data_management_plans_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- ─── network_datasets ─────────────────────────────────────────────────────────
ALTER TABLE network_datasets
  DROP CONSTRAINT IF EXISTS network_datasets_published_by_fkey,
  ADD CONSTRAINT network_datasets_published_by_fkey
    FOREIGN KEY (published_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- ─── protocol_registrations ───────────────────────────────────────────────────
ALTER TABLE protocol_registrations
  DROP CONSTRAINT IF EXISTS protocol_registrations_created_by_fkey,
  ADD CONSTRAINT protocol_registrations_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- ─── cross_institution_invites ────────────────────────────────────────────────
ALTER TABLE cross_institution_invites
  ALTER COLUMN inviter_id DROP NOT NULL;
ALTER TABLE cross_institution_invites
  DROP CONSTRAINT IF EXISTS cross_institution_invites_inviter_id_fkey,
  ADD CONSTRAINT cross_institution_invites_inviter_id_fkey
    FOREIGN KEY (inviter_id) REFERENCES profiles(id) ON DELETE SET NULL;

-- ─── integration_connections ──────────────────────────────────────────────────
ALTER TABLE integration_connections
  DROP CONSTRAINT IF EXISTS integration_connections_created_by_fkey,
  ADD CONSTRAINT integration_connections_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- ─── journal_submissions / templates ─────────────────────────────────────────
ALTER TABLE journal_submissions
  DROP CONSTRAINT IF EXISTS journal_submissions_created_by_fkey,
  ADD CONSTRAINT journal_submissions_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE journal_templates
  DROP CONSTRAINT IF EXISTS journal_templates_contributed_by_fkey,
  ADD CONSTRAINT journal_templates_contributed_by_fkey
    FOREIGN KEY (contributed_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- ─── dhis2_push_logs ──────────────────────────────────────────────────────────
ALTER TABLE dhis2_push_logs
  DROP CONSTRAINT IF EXISTS dhis2_push_logs_created_by_fkey,
  ADD CONSTRAINT dhis2_push_logs_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- ─── approval_gates ───────────────────────────────────────────────────────────
ALTER TABLE approval_gates
  DROP CONSTRAINT IF EXISTS approval_gates_approved_by_fkey,
  ADD CONSTRAINT approval_gates_approved_by_fkey
    FOREIGN KEY (approved_by) REFERENCES profiles(id) ON DELETE SET NULL;
