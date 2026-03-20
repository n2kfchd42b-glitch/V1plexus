-- ════════════════════════════════════════
-- PLEXUS Phase 3: Reviews & Notifications
-- ════════════════════════════════════════

-- ════════════════════════════════════════
-- DOCUMENT COMMENTS (anchored to text)
-- ════════════════════════════════════════
CREATE TABLE document_comments (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id     UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  author_id       UUID NOT NULL REFERENCES profiles(id),
  content         TEXT NOT NULL,
  anchor_from     INTEGER,
  anchor_to       INTEGER,
  anchor_text     TEXT,
  is_resolved     BOOLEAN DEFAULT false,
  resolved_by     UUID REFERENCES profiles(id),
  resolved_at     TIMESTAMPTZ,
  parent_id       UUID REFERENCES document_comments(id),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_doc_comments_document ON document_comments(document_id);

-- ════════════════════════════════════════
-- REVIEW REQUESTS
-- ════════════════════════════════════════
CREATE TABLE review_requests (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id       UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  document_version  INTEGER NOT NULL,
  requested_by      UUID NOT NULL REFERENCES profiles(id),
  assigned_to       UUID NOT NULL REFERENCES profiles(id),
  priority          TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  status            TEXT DEFAULT 'pending' CHECK (status IN (
                      'pending', 'in_review', 'feedback_given',
                      'revision_submitted', 'approved', 'rejected'
                    )),
  feedback_text     TEXT,
  due_date          DATE,
  requested_at      TIMESTAMPTZ DEFAULT now(),
  started_at        TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_reviews_assigned ON review_requests(assigned_to, status);
CREATE INDEX idx_reviews_document ON review_requests(document_id);

-- ════════════════════════════════════════
-- REVIEW COMMENTS
-- ════════════════════════════════════════
CREATE TABLE review_comments (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  review_id       UUID NOT NULL REFERENCES review_requests(id) ON DELETE CASCADE,
  author_id       UUID NOT NULL REFERENCES profiles(id),
  content         TEXT NOT NULL,
  section_key     TEXT,
  anchor_start    INTEGER,
  anchor_end      INTEGER,
  is_resolved     BOOLEAN DEFAULT false,
  resolved_by     UUID REFERENCES profiles(id),
  parent_id       UUID REFERENCES review_comments(id),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_review_comments_review ON review_comments(review_id);

-- ════════════════════════════════════════
-- APPROVAL GATES
-- ════════════════════════════════════════
CREATE TABLE approval_gates (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  gate_type           TEXT NOT NULL,
  title               TEXT NOT NULL,
  description         TEXT,
  status              TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'blocked')),
  approved_by         UUID REFERENCES profiles(id),
  approved_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_gates_project ON approval_gates(project_id);

-- ════════════════════════════════════════
-- NOTIFICATIONS
-- ════════════════════════════════════════
CREATE TABLE notifications (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  body            TEXT,
  type            TEXT NOT NULL,
  resource_type   TEXT,
  resource_id     UUID,
  is_read         BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_notifications_user ON notifications(user_id, is_read, created_at DESC);

-- RLS
ALTER TABLE document_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_gates ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Notifications: users see only their own
CREATE POLICY "Users see own notifications" ON notifications
  FOR ALL TO authenticated USING (user_id = auth.uid());

-- Reviews: assigned reviewer and requester can see/update
CREATE POLICY "Review participants can see reviews" ON review_requests
  FOR SELECT TO authenticated USING (
    assigned_to = auth.uid() OR requested_by = auth.uid()
  );

CREATE POLICY "Review participants can update reviews" ON review_requests
  FOR UPDATE TO authenticated USING (
    assigned_to = auth.uid() OR requested_by = auth.uid()
  );

CREATE POLICY "Authenticated can create reviews" ON review_requests
  FOR INSERT TO authenticated WITH CHECK (requested_by = auth.uid());

-- Document comments: everyone can read; authors can write
CREATE POLICY "Document comments viewable by authenticated" ON document_comments
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can create comments" ON document_comments
  FOR INSERT TO authenticated WITH CHECK (author_id = auth.uid());

CREATE POLICY "Authors can update own comments" ON document_comments
  FOR UPDATE TO authenticated USING (author_id = auth.uid());

-- Review comments: review participants
CREATE POLICY "Review comments viewable by authenticated" ON review_comments
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can create review comments" ON review_comments
  FOR INSERT TO authenticated WITH CHECK (author_id = auth.uid());

-- Approval gates: viewable by all; updated by supervisors/admins
CREATE POLICY "Approval gates viewable by authenticated" ON approval_gates
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Supervisors can manage approval gates" ON approval_gates
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid()
      AND role IN ('supervisor', 'admin')
    )
  );

-- Triggers
CREATE TRIGGER set_updated_at BEFORE UPDATE ON document_comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON review_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON review_comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON approval_gates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Helper function to create notifications
CREATE OR REPLACE FUNCTION create_notification(
  p_user_id UUID,
  p_title TEXT,
  p_body TEXT,
  p_type TEXT,
  p_resource_type TEXT DEFAULT NULL,
  p_resource_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO notifications (user_id, title, body, type, resource_type, resource_id)
  VALUES (p_user_id, p_title, p_body, p_type, p_resource_type, p_resource_id)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: notify reviewer when review is requested
CREATE OR REPLACE FUNCTION notify_review_requested()
RETURNS TRIGGER AS $$
DECLARE
  v_requester_name TEXT;
  v_doc_title TEXT;
BEGIN
  SELECT full_name INTO v_requester_name FROM profiles WHERE id = NEW.requested_by;
  SELECT title INTO v_doc_title FROM documents WHERE id = NEW.document_id;

  PERFORM create_notification(
    NEW.assigned_to,
    'New Review Request',
    v_requester_name || ' requested a review for "' || v_doc_title || '"',
    'review_request',
    'review',
    NEW.id
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_review_requested
  AFTER INSERT ON review_requests
  FOR EACH ROW EXECUTE FUNCTION notify_review_requested();

-- Trigger: notify requester when review is completed
CREATE OR REPLACE FUNCTION notify_review_completed()
RETURNS TRIGGER AS $$
DECLARE
  v_reviewer_name TEXT;
  v_doc_title TEXT;
BEGIN
  IF OLD.status != NEW.status AND NEW.status IN ('approved', 'rejected', 'feedback_given') THEN
    SELECT full_name INTO v_reviewer_name FROM profiles WHERE id = NEW.assigned_to;
    SELECT title INTO v_doc_title FROM documents WHERE id = NEW.document_id;

    PERFORM create_notification(
      NEW.requested_by,
      CASE NEW.status
        WHEN 'approved' THEN 'Document Approved'
        WHEN 'rejected' THEN 'Document Rejected'
        ELSE 'Review Feedback Given'
      END,
      v_reviewer_name || ' has ' ||
      CASE NEW.status
        WHEN 'approved' THEN 'approved'
        WHEN 'rejected' THEN 'rejected'
        ELSE 'given feedback on'
      END || ' "' || v_doc_title || '"',
      'review_complete',
      'review',
      NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_review_completed
  AFTER UPDATE ON review_requests
  FOR EACH ROW EXECUTE FUNCTION notify_review_completed();

-- Trigger: notify document creator when comment is added
CREATE OR REPLACE FUNCTION notify_document_comment()
RETURNS TRIGGER AS $$
DECLARE
  v_author_name TEXT;
  v_doc_title TEXT;
  v_doc_creator UUID;
BEGIN
  SELECT full_name INTO v_author_name FROM profiles WHERE id = NEW.author_id;
  SELECT title, created_by INTO v_doc_title, v_doc_creator FROM documents WHERE id = NEW.document_id;

  IF v_doc_creator != NEW.author_id THEN
    PERFORM create_notification(
      v_doc_creator,
      'New Comment',
      v_author_name || ' commented on "' || v_doc_title || '"',
      'comment',
      'document',
      NEW.document_id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_document_comment
  AFTER INSERT ON document_comments
  FOR EACH ROW EXECUTE FUNCTION notify_document_comment();

-- Trigger: notify project owner when gate is approved
CREATE OR REPLACE FUNCTION notify_gate_approved()
RETURNS TRIGGER AS $$
DECLARE
  v_approver_name TEXT;
  v_project_owner UUID;
BEGIN
  IF OLD.status != 'approved' AND NEW.status = 'approved' THEN
    SELECT full_name INTO v_approver_name FROM profiles WHERE id = NEW.approved_by;
    SELECT owner_id INTO v_project_owner FROM projects WHERE id = NEW.project_id;

    IF v_project_owner != NEW.approved_by THEN
      PERFORM create_notification(
        v_project_owner,
        'Approval Gate Passed',
        '"' || NEW.title || '" has been approved by ' || v_approver_name,
        'gate_approved',
        'project',
        NEW.project_id
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_gate_approved
  AFTER UPDATE ON approval_gates
  FOR EACH ROW EXECUTE FUNCTION notify_gate_approved();
