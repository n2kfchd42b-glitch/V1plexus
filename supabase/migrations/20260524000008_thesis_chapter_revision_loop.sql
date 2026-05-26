-- ════════════════════════════════════════════════════════════════════════════
-- THESIS CHAPTER REVISION LOOP
--
-- Today the chapter card flips status directly with no provenance. This adds
-- a proper revision loop that mirrors the proven milestone_submissions
-- pattern: append-only submission rows, one per round, each anchoring a
-- snapshot of the document at submit-time and pointing at the review_request
-- that supervisors comment on.
--
-- Existing rows keep working unchanged — new columns are nullable / defaulted.
-- ════════════════════════════════════════════════════════════════════════════

SET search_path = public;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. EXTEND thesis_chapters
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE thesis_chapters
  ADD COLUMN IF NOT EXISTS revision_round    INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS current_review_id UUID REFERENCES review_requests(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_thesis_chapters_current_review
  ON thesis_chapters (current_review_id)
  WHERE current_review_id IS NOT NULL;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. thesis_chapter_submissions
--
-- Append-only ledger. One row per submit (student-side); one UPDATE per
-- decision (supervisor-side). Rows are never deleted.
--
-- document_version_number is recorded at submit time even when a matching
-- document_versions row hasn't been minted yet — it lets the history view
-- reconstruct "what was on screen when this was submitted" without forcing
-- the editor to create a version every time.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS thesis_chapter_submissions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id              UUID NOT NULL REFERENCES thesis_chapters(id) ON DELETE CASCADE,
  project_id              UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  student_id              UUID NOT NULL REFERENCES profiles(id),
  round                   INTEGER NOT NULL DEFAULT 1,
  document_id             UUID REFERENCES documents(id) ON DELETE SET NULL,
  document_version_number INTEGER,
  note                    TEXT,
  review_request_id       UUID REFERENCES review_requests(id) ON DELETE SET NULL,
  submitted_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Decision filled by the supervisor (single UPDATE, then frozen by trigger)
  reviewed_by             UUID REFERENCES profiles(id),
  reviewed_at             TIMESTAMPTZ,
  decision                TEXT CHECK (decision IN ('approved', 'revision_requested')),
  feedback                TEXT,

  UNIQUE (chapter_id, round)
);

CREATE INDEX IF NOT EXISTS idx_thesis_chapter_submissions_chapter
  ON thesis_chapter_submissions (chapter_id, round DESC);
CREATE INDEX IF NOT EXISTS idx_thesis_chapter_submissions_project
  ON thesis_chapter_submissions (project_id);
CREATE INDEX IF NOT EXISTS idx_thesis_chapter_submissions_student
  ON thesis_chapter_submissions (student_id, submitted_at DESC);


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. ROW LEVEL SECURITY
--
-- Mirrors the visibility model already used for thesis_chapters: anyone who
-- can see the chapter can see the submissions; only the student can INSERT;
-- only an active supervisor can record a decision via UPDATE.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE thesis_chapter_submissions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'thesis_chapter_submissions' AND policyname = 'submissions_select'
  ) THEN
    CREATE POLICY "submissions_select" ON thesis_chapter_submissions
      FOR SELECT TO authenticated USING (
        project_id IN (
          SELECT id FROM projects WHERE owner_id = auth.uid()
          UNION
          SELECT project_id FROM project_members WHERE user_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1 FROM supervisor_assignments sa
          WHERE sa.supervisor_id = auth.uid()
            AND sa.student_id    = thesis_chapter_submissions.student_id
            AND sa.status        = 'active'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'thesis_chapter_submissions' AND policyname = 'submissions_insert_student'
  ) THEN
    CREATE POLICY "submissions_insert_student" ON thesis_chapter_submissions
      FOR INSERT TO authenticated WITH CHECK (
        student_id = auth.uid()
        AND project_id IN (SELECT id FROM projects WHERE owner_id = auth.uid())
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'thesis_chapter_submissions' AND policyname = 'submissions_decide_supervisor'
  ) THEN
    CREATE POLICY "submissions_decide_supervisor" ON thesis_chapter_submissions
      FOR UPDATE TO authenticated USING (
        EXISTS (
          SELECT 1 FROM supervisor_assignments sa
          WHERE sa.supervisor_id = auth.uid()
            AND sa.student_id    = thesis_chapter_submissions.student_id
            AND sa.status        = 'active'
        )
      );
  END IF;
END $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. APPEND-ONLY GUARD
--
-- Lock the immutable columns (student_id, document_id snapshot, round,
-- submitted_at) and prevent re-deciding a closed submission.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION freeze_chapter_submission()
RETURNS TRIGGER AS $$
BEGIN
  -- Once a decision is recorded, nothing else may change
  IF OLD.decision IS NOT NULL AND
     (NEW.decision IS DISTINCT FROM OLD.decision OR
      NEW.feedback IS DISTINCT FROM OLD.feedback OR
      NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by) THEN
    RAISE EXCEPTION 'This submission is already closed and cannot be re-decided'
      USING ERRCODE = 'check_violation';
  END IF;

  -- Submit-time fields are forever
  NEW.id                      := OLD.id;
  NEW.chapter_id              := OLD.chapter_id;
  NEW.project_id              := OLD.project_id;
  NEW.student_id              := OLD.student_id;
  NEW.round                   := OLD.round;
  NEW.document_id             := OLD.document_id;
  NEW.document_version_number := OLD.document_version_number;
  NEW.note                    := OLD.note;
  NEW.review_request_id       := OLD.review_request_id;
  NEW.submitted_at            := OLD.submitted_at;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS thesis_chapter_submissions_freeze ON thesis_chapter_submissions;
CREATE TRIGGER thesis_chapter_submissions_freeze
  BEFORE UPDATE ON thesis_chapter_submissions
  FOR EACH ROW EXECUTE FUNCTION freeze_chapter_submission();


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. AUDIT REGISTRY (already inserted in 20260524000005; safe-add new resource)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.audit_resource_registry (resource_type) VALUES
  ('thesis_chapter_submission')
ON CONFLICT (resource_type) DO NOTHING;
