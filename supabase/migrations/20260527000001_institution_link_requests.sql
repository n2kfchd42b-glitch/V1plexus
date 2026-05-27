-- ════════════════════════════════════════
-- PLEXUS — Institution link requests (PR B)
-- Individual users opt-in to a registered institution. Requests are either
-- auto-approved (when the user's email domain matches the institution's
-- auto_link_domains list — opt-in per institution) or queued for an
-- institutional admin/coordinator to review.
-- ════════════════════════════════════════

CREATE TABLE IF NOT EXISTS institution_link_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  institution_id  UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (
                    status IN ('pending', 'approved', 'declined', 'cancelled')
                  ),
  message         TEXT,
  auto_approved   BOOLEAN NOT NULL DEFAULT FALSE,
  decided_by      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  decided_at      TIMESTAMPTZ,
  decline_reason  TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- At most one pending request per (user, institution).
CREATE UNIQUE INDEX IF NOT EXISTS uniq_institution_link_requests_pending
  ON institution_link_requests (user_id, institution_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_institution_link_requests_institution_status
  ON institution_link_requests (institution_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_institution_link_requests_user
  ON institution_link_requests (user_id, created_at DESC);

DROP TRIGGER IF EXISTS set_updated_at ON institution_link_requests;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON institution_link_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE institution_link_requests ENABLE ROW LEVEL SECURITY;

-- ── Users: own requests ─────────────────────────────────────────────────────
-- A user can see and submit their own link requests, and cancel a pending one.
-- The "approve" / "decline" transitions are handled server-side via the
-- service-role key (so user UPDATE policy is restricted to setting cancelled).

DROP POLICY IF EXISTS "Users see own link requests" ON institution_link_requests;
CREATE POLICY "Users see own link requests" ON institution_link_requests
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users create own link requests" ON institution_link_requests;
CREATE POLICY "Users create own link requests" ON institution_link_requests
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users cancel own pending link requests" ON institution_link_requests;
CREATE POLICY "Users cancel own pending link requests" ON institution_link_requests
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND status = 'pending')
  WITH CHECK (user_id = auth.uid() AND status IN ('pending', 'cancelled'));

-- ── Institution admins/coordinators: requests targeting their institution ──
-- Admins and coordinators (recognised via profiles.role + profiles.institution_id)
-- can read all requests for their institution. Status transitions
-- (pending → approved/declined) are written via the API using the service-role
-- key so we can also flip profile.institution_id and insert the workspace
-- membership in one server-side step.

DROP POLICY IF EXISTS "Institution admins see institution link requests" ON institution_link_requests;
CREATE POLICY "Institution admins see institution link requests" ON institution_link_requests
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.institution_id = institution_link_requests.institution_id
        AND p.role IN ('admin', 'coordinator')
    )
  );
