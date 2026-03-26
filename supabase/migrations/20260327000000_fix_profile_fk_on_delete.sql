-- Fix missing ON DELETE rules on every REFERENCES profiles(id) FK.
--
-- Root cause: Supabase's "Delete user" button deletes from auth.users,
-- which cascades to profiles (via profiles.id ON DELETE CASCADE), but
-- every other table that references profiles(id) had no ON DELETE rule,
-- defaulting to RESTRICT — blocking the entire deletion chain.
--
-- Strategy:
--   CASCADE  — structural/ownership FKs where the row is meaningless
--              without the referenced user (owner, membership, assignments,
--              invitations, reviews, notifications, logs, etc.)
--   SET NULL — nullable audit-trail FKs (created_by, invited_by, actor_id,
--              resolved_by, etc.) where the record should survive the user.

-- ─── workspaces ───────────────────────────────────────────────────────────────
ALTER TABLE workspaces
  DROP CONSTRAINT IF EXISTS workspaces_owner_id_fkey,
  ADD CONSTRAINT workspaces_owner_id_fkey
    FOREIGN KEY (owner_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- ─── workspace_memberships ────────────────────────────────────────────────────
-- user_id already CASCADE; fix the nullable audit FKs
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

ALTER TABLE workspace_invitations
  DROP CONSTRAINT IF EXISTS workspace_invitations_invited_by_fkey,
  ADD CONSTRAINT workspace_invitations_invited_by_fkey
    FOREIGN KEY (invited_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- ─── project_invitations ──────────────────────────────────────────────────────
ALTER TABLE project_invitations
  DROP CONSTRAINT IF EXISTS project_invitations_invited_by_fkey,
  ADD CONSTRAINT project_invitations_invited_by_fkey
    FOREIGN KEY (invited_by) REFERENCES profiles(id) ON DELETE SET NULL;

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

-- ─── user_roles ───────────────────────────────────────────────────────────────
ALTER TABLE user_roles
  DROP CONSTRAINT IF EXISTS user_roles_granted_by_fkey,
  ADD CONSTRAINT user_roles_granted_by_fkey
    FOREIGN KEY (granted_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- ─── documents / ethics ───────────────────────────────────────────────────────
ALTER TABLE documents
  DROP CONSTRAINT IF EXISTS documents_locked_by_fkey,
  ADD CONSTRAINT documents_locked_by_fkey
    FOREIGN KEY (locked_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE documents
  DROP CONSTRAINT IF EXISTS documents_created_by_fkey,
  ADD CONSTRAINT documents_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE document_comments
  DROP CONSTRAINT IF EXISTS document_comments_created_by_fkey,
  ADD CONSTRAINT document_comments_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE ethics_submissions
  DROP CONSTRAINT IF EXISTS ethics_submissions_created_by_fkey,
  ADD CONSTRAINT ethics_submissions_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE ethics_documents
  DROP CONSTRAINT IF EXISTS ethics_documents_uploaded_by_fkey,
  ADD CONSTRAINT ethics_documents_uploaded_by_fkey
    FOREIGN KEY (uploaded_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE ethics_amendments
  DROP CONSTRAINT IF EXISTS ethics_amendments_created_by_fkey,
  ADD CONSTRAINT ethics_amendments_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- ─── reviews / notifications ──────────────────────────────────────────────────
ALTER TABLE review_comments
  DROP CONSTRAINT IF EXISTS review_comments_author_id_fkey,
  ADD CONSTRAINT review_comments_author_id_fkey
    FOREIGN KEY (author_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE review_comments
  DROP CONSTRAINT IF EXISTS review_comments_resolved_by_fkey,
  ADD CONSTRAINT review_comments_resolved_by_fkey
    FOREIGN KEY (resolved_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE peer_reviews
  DROP CONSTRAINT IF EXISTS peer_reviews_requested_by_fkey,
  ADD CONSTRAINT peer_reviews_requested_by_fkey
    FOREIGN KEY (requested_by) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE peer_reviews
  DROP CONSTRAINT IF EXISTS peer_reviews_assigned_to_fkey,
  ADD CONSTRAINT peer_reviews_assigned_to_fkey
    FOREIGN KEY (assigned_to) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE section_comments
  DROP CONSTRAINT IF EXISTS section_comments_author_id_fkey,
  ADD CONSTRAINT section_comments_author_id_fkey
    FOREIGN KEY (author_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE section_comments
  DROP CONSTRAINT IF EXISTS section_comments_resolved_by_fkey,
  ADD CONSTRAINT section_comments_resolved_by_fkey
    FOREIGN KEY (resolved_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE approval_workflows
  DROP CONSTRAINT IF EXISTS approval_workflows_approved_by_fkey,
  ADD CONSTRAINT approval_workflows_approved_by_fkey
    FOREIGN KEY (approved_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- ─── audit / AI logs ──────────────────────────────────────────────────────────
ALTER TABLE audit_logs
  DROP CONSTRAINT IF EXISTS audit_logs_actor_id_fkey,
  ADD CONSTRAINT audit_logs_actor_id_fkey
    FOREIGN KEY (actor_id) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE ai_assistance_log
  DROP CONSTRAINT IF EXISTS ai_assistance_log_user_id_fkey,
  ADD CONSTRAINT ai_assistance_log_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- ─── data infrastructure ──────────────────────────────────────────────────────
ALTER TABLE datasets
  DROP CONSTRAINT IF EXISTS datasets_uploaded_by_fkey,
  ADD CONSTRAINT datasets_uploaded_by_fkey
    FOREIGN KEY (uploaded_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE dataset_versions
  DROP CONSTRAINT IF EXISTS dataset_versions_created_by_fkey,
  ADD CONSTRAINT dataset_versions_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE data_pipelines
  DROP CONSTRAINT IF EXISTS data_pipelines_created_by_fkey,
  ADD CONSTRAINT data_pipelines_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE analysis_jobs
  DROP CONSTRAINT IF EXISTS analysis_jobs_created_by_fkey,
  ADD CONSTRAINT analysis_jobs_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE analysis_runs
  DROP CONSTRAINT IF EXISTS analysis_runs_created_by_fkey,
  ADD CONSTRAINT analysis_runs_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- ─── project milestones ───────────────────────────────────────────────────────
ALTER TABLE project_milestones
  DROP CONSTRAINT IF EXISTS project_milestones_created_by_fkey,
  ADD CONSTRAINT project_milestones_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- ─── field operations ─────────────────────────────────────────────────────────
ALTER TABLE field_sites
  DROP CONSTRAINT IF EXISTS field_sites_created_by_fkey,
  ADD CONSTRAINT field_sites_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE field_observations
  DROP CONSTRAINT IF EXISTS field_observations_created_by_fkey,
  ADD CONSTRAINT field_observations_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE field_observations
  DROP CONSTRAINT IF EXISTS field_observations_resolved_by_fkey,
  ADD CONSTRAINT field_observations_resolved_by_fkey
    FOREIGN KEY (resolved_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- ─── thesis management ────────────────────────────────────────────────────────
ALTER TABLE thesis_committee_members
  DROP CONSTRAINT IF EXISTS thesis_committee_members_user_id_fkey,
  ADD CONSTRAINT thesis_committee_members_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE thesis_committee_members
  DROP CONSTRAINT IF EXISTS thesis_committee_members_invited_by_fkey,
  ADD CONSTRAINT thesis_committee_members_invited_by_fkey
    FOREIGN KEY (invited_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE thesis_defenses
  DROP CONSTRAINT IF EXISTS thesis_defenses_approved_by_fkey,
  ADD CONSTRAINT thesis_defenses_approved_by_fkey
    FOREIGN KEY (approved_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- ─── publication pipeline ─────────────────────────────────────────────────────
ALTER TABLE manuscript_contributions
  DROP CONSTRAINT IF EXISTS manuscript_contributions_contributed_by_fkey,
  ADD CONSTRAINT manuscript_contributions_contributed_by_fkey
    FOREIGN KEY (contributed_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE manuscripts
  DROP CONSTRAINT IF EXISTS manuscripts_created_by_fkey,
  ADD CONSTRAINT manuscripts_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE manuscript_versions
  DROP CONSTRAINT IF EXISTS manuscript_versions_created_by_fkey,
  ADD CONSTRAINT manuscript_versions_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE cover_letters
  DROP CONSTRAINT IF EXISTS cover_letters_created_by_fkey,
  ADD CONSTRAINT cover_letters_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE submission_tracking
  DROP CONSTRAINT IF EXISTS submission_tracking_created_by_fkey,
  ADD CONSTRAINT submission_tracking_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- ─── external integrations ────────────────────────────────────────────────────
ALTER TABLE external_integrations
  DROP CONSTRAINT IF EXISTS external_integrations_created_by_fkey,
  ADD CONSTRAINT external_integrations_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- ─── institutional intelligence ───────────────────────────────────────────────
ALTER TABLE research_programs
  DROP CONSTRAINT IF EXISTS research_programs_pi_id_fkey,
  ADD CONSTRAINT research_programs_pi_id_fkey
    FOREIGN KEY (pi_id) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE research_programs
  DROP CONSTRAINT IF EXISTS research_programs_created_by_fkey,
  ADD CONSTRAINT research_programs_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- ─── network & compliance ─────────────────────────────────────────────────────
ALTER TABLE protocol_registry
  DROP CONSTRAINT IF EXISTS protocol_registry_published_by_fkey,
  ADD CONSTRAINT protocol_registry_published_by_fkey
    FOREIGN KEY (published_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE collaboration_requests
  DROP CONSTRAINT IF EXISTS collaboration_requests_requester_id_fkey,
  ADD CONSTRAINT collaboration_requests_requester_id_fkey
    FOREIGN KEY (requester_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE collaboration_requests
  DROP CONSTRAINT IF EXISTS collaboration_requests_reviewed_by_fkey,
  ADD CONSTRAINT collaboration_requests_reviewed_by_fkey
    FOREIGN KEY (reviewed_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE network_invitations
  DROP CONSTRAINT IF EXISTS network_invitations_inviter_id_fkey,
  ADD CONSTRAINT network_invitations_inviter_id_fkey
    FOREIGN KEY (inviter_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE regulatory_approvals
  DROP CONSTRAINT IF EXISTS regulatory_approvals_approved_by_fkey,
  ADD CONSTRAINT regulatory_approvals_approved_by_fkey
    FOREIGN KEY (approved_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE regulatory_approvals
  DROP CONSTRAINT IF EXISTS regulatory_approvals_created_by_fkey,
  ADD CONSTRAINT regulatory_approvals_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE biospecimen_tracking
  DROP CONSTRAINT IF EXISTS biospecimen_tracking_collected_by_fkey,
  ADD CONSTRAINT biospecimen_tracking_collected_by_fkey
    FOREIGN KEY (collected_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE adverse_events
  DROP CONSTRAINT IF EXISTS adverse_events_action_by_fkey,
  ADD CONSTRAINT adverse_events_action_by_fkey
    FOREIGN KEY (action_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE safety_reports
  DROP CONSTRAINT IF EXISTS safety_reports_created_by_fkey,
  ADD CONSTRAINT safety_reports_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
