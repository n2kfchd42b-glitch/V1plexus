-- ─── Phase 2: Supervisor Approval Workflow ──────────────────────────────────
-- Adds dataset version approval gates before analysis

-- ─── 1. Add link column to notifications (existing table) ──────────────────

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS link TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Extend notifications type check to include approval events
-- (no CHECK constraint on type in original table, so just document new values:
--  'approval_requested', 'approval_granted', 'approval_rejected',
--  'revision_requested', 'approval_resubmitted')

-- ─── 2. dataset_approval_requests ──────────────────────────────────────────

CREATE TABLE public.dataset_approval_requests (
  id                    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  dataset_id            UUID NOT NULL REFERENCES datasets(id)         ON DELETE CASCADE,
  version_id            UUID NOT NULL REFERENCES dataset_versions(id) ON DELETE CASCADE,
  project_id            UUID NOT NULL REFERENCES projects(id)         ON DELETE CASCADE,
  requested_by          UUID NOT NULL REFERENCES profiles(id)         ON DELETE CASCADE,
  assigned_supervisor   UUID          REFERENCES profiles(id)         ON DELETE SET NULL,
  status                TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','in_review','approved','rejected','revision_requested')),
  request_message       TEXT,
  reviewer_note         TEXT,
  requested_at          TIMESTAMPTZ DEFAULT now() NOT NULL,
  reviewed_at           TIMESTAMPTZ,
  reviewed_by           UUID          REFERENCES profiles(id)         ON DELETE SET NULL,
  approved_version_hash TEXT,
  expires_at            TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),
  UNIQUE(dataset_id, version_id)
);

CREATE INDEX idx_approval_dataset
  ON dataset_approval_requests(dataset_id, status);
CREATE INDEX idx_approval_supervisor
  ON dataset_approval_requests(assigned_supervisor, status)
  WHERE assigned_supervisor IS NOT NULL;
CREATE INDEX idx_approval_project
  ON dataset_approval_requests(project_id, status);
CREATE INDEX idx_approval_requested_by
  ON dataset_approval_requests(requested_by, status);

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON dataset_approval_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── 3. approval_review_history ────────────────────────────────────────────

CREATE TABLE public.approval_review_history (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id   UUID NOT NULL REFERENCES dataset_approval_requests(id) ON DELETE CASCADE,
  reviewer_id  UUID NOT NULL REFERENCES profiles(id)                  ON DELETE CASCADE,
  action       TEXT NOT NULL
    CHECK (action IN ('submitted','viewed','approved','rejected','revision_requested','resubmitted')),
  note         TEXT,
  audit_entry_id UUID,
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_review_history_request
  ON approval_review_history(request_id, created_at DESC);

-- ─── 4. RLS ────────────────────────────────────────────────────────────────

ALTER TABLE dataset_approval_requests  ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_review_history    ENABLE ROW LEVEL SECURITY;

-- Researchers see their own requests
CREATE POLICY "Researchers see own requests"
  ON dataset_approval_requests FOR SELECT TO authenticated
  USING (requested_by = auth.uid());

-- Supervisors see requests assigned to them or open requests in their projects
CREATE POLICY "Supervisors see project requests"
  ON dataset_approval_requests FOR SELECT TO authenticated
  USING (
    assigned_supervisor = auth.uid()
    OR (
      assigned_supervisor IS NULL
      AND project_id IN (
        SELECT project_id FROM project_members WHERE user_id = auth.uid()
      )
    )
  );

-- Only researchers can submit
CREATE POLICY "Researchers can submit requests"
  ON dataset_approval_requests FOR INSERT TO authenticated
  WITH CHECK (requested_by = auth.uid());

-- Status updates by reviewer
CREATE POLICY "Reviewers can update status"
  ON dataset_approval_requests FOR UPDATE TO authenticated
  USING (
    assigned_supervisor = auth.uid()
    OR reviewed_by = auth.uid()
  );

-- Review history visible to participants
CREATE POLICY "Participants see review history"
  ON approval_review_history FOR SELECT TO authenticated
  USING (
    request_id IN (
      SELECT id FROM dataset_approval_requests
      WHERE requested_by = auth.uid()
         OR assigned_supervisor = auth.uid()
         OR reviewed_by = auth.uid()
    )
  );

-- Only reviewers insert history
CREATE POLICY "Reviewers write history"
  ON approval_review_history FOR INSERT TO authenticated
  WITH CHECK (reviewer_id = auth.uid());
