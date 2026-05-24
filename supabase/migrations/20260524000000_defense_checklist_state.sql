-- Track manual checklist items that gate scheduling the defense.
-- Timestamps (not booleans) so we know WHEN the student/admin marked them.
ALTER TABLE thesis_defenses
  ADD COLUMN IF NOT EXISTS format_check_completed_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS final_submission_at        TIMESTAMPTZ;
