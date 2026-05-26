-- ════════════════════════════════════════
-- PLEXUS — Institution admin provisioning (PR A)
-- Sales-driven onboarding: public inquiry form + platform-admin tool
-- for creating institutions and inviting their first admin.
-- ════════════════════════════════════════

-- ── institutions: provisioning + auto-link metadata ──────────────────────────

ALTER TABLE institutions
  ADD COLUMN IF NOT EXISTS auto_link_domains TEXT[] NOT NULL DEFAULT '{}'::text[];

ALTER TABLE institutions
  ADD COLUMN IF NOT EXISTS provisioned_at TIMESTAMPTZ;

ALTER TABLE institutions
  ADD COLUMN IF NOT EXISTS provisioned_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE institutions
  ADD COLUMN IF NOT EXISTS provisioning_notes TEXT;

-- ── institution_inquiries ────────────────────────────────────────────────────
-- Public contact form submissions from prospective institutions.
-- INSERT is allowed for anon (form is public). Reads/updates are platform-admin only;
-- the admin tool uses the service-role key, so no policy is needed for that path.

CREATE TABLE IF NOT EXISTS institution_inquiries (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_name              TEXT NOT NULL,
  contact_email             TEXT NOT NULL,
  contact_role              TEXT,
  institution_name          TEXT NOT NULL,
  country                   TEXT,
  estimated_seats           INTEGER,
  message                   TEXT,
  status                    TEXT NOT NULL DEFAULT 'new' CHECK (
                              status IN ('new', 'responded', 'converted', 'declined')
                            ),
  converted_institution_id  UUID REFERENCES institutions(id) ON DELETE SET NULL,
  responded_at              TIMESTAMPTZ,
  responded_by              UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_institution_inquiries_status
  ON institution_inquiries (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_institution_inquiries_email
  ON institution_inquiries (contact_email);

DROP TRIGGER IF EXISTS set_updated_at ON institution_inquiries;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON institution_inquiries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE institution_inquiries ENABLE ROW LEVEL SECURITY;

-- Anyone (including unauthenticated visitors) can submit an inquiry.
DROP POLICY IF EXISTS "Anyone can submit an inquiry" ON institution_inquiries;
CREATE POLICY "Anyone can submit an inquiry" ON institution_inquiries
  FOR INSERT TO anon, authenticated WITH CHECK (true);

-- No SELECT / UPDATE / DELETE policies: only the service-role key
-- (used by the platform-admin tool) can read or mutate inquiries.
