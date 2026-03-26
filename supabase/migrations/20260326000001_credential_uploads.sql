-- ══════════════════════════════════════════════════════════════════
-- TABLE: credential_uploads
-- Tracks user-uploaded credential documents and their verification status
-- ══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS credential_uploads (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  file_name       TEXT        NOT NULL,
  storage_path    TEXT        NOT NULL,           -- path inside credentials bucket
  file_size_bytes BIGINT,
  mime_type       TEXT,
  status          TEXT        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending', 'under_review', 'approved', 'rejected')),
  reviewer_notes  TEXT,                           -- admin notes on rejection/approval
  uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Keep updated_at fresh
CREATE OR REPLACE FUNCTION touch_credential_uploads()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER credential_uploads_updated_at
  BEFORE UPDATE ON credential_uploads
  FOR EACH ROW EXECUTE FUNCTION touch_credential_uploads();

-- ── RLS ──────────────────────────────────────────────────────────
ALTER TABLE credential_uploads ENABLE ROW LEVEL SECURITY;

-- Users can insert their own uploads
CREATE POLICY "Users can insert own credential uploads"
ON credential_uploads FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

-- Users can view their own uploads
CREATE POLICY "Users can view own credential uploads"
ON credential_uploads FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- Users cannot update status themselves (admin-only via service role)
-- Admins can view all uploads to perform review
CREATE POLICY "Admins can view all credential uploads"
ON credential_uploads FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Admins can update credential upload status"
ON credential_uploads FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- ── Index for fast user lookups ───────────────────────────────────
CREATE INDEX IF NOT EXISTS credential_uploads_user_id_idx ON credential_uploads(user_id);
CREATE INDEX IF NOT EXISTS credential_uploads_status_idx  ON credential_uploads(status);
