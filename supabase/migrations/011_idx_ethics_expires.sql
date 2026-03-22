-- ════════════════════════════════════════
-- H7: Add idx_ethics_expires index
-- Speeds up the notification query that surfaces
-- ethics approvals approaching or past expiry_date.
-- Partial index skips rows with no expiry set.
-- ════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_ethics_expires
  ON ethics_applications(expires_at)
  WHERE expires_at IS NOT NULL;
