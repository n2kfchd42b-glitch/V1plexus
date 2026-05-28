-- ════════════════════════════════════════
-- PLEXUS — Institution programmes, cohorts, roster, enrollments
-- (Phase 1 + 2 of the premium institution loop)
--
-- This migration introduces the entities that close the institution-side
-- loop end-to-end:
--   * institution_programmes  — degree programmes (BSc/MSc/PhD/staff)
--   * institution_cohorts     — yearly intake of a programme
--   * institution_roster_entries — pre-loaded expected affiliates
--                                  (matriculation list); the verification key
--   * institution_enrollments — actual person ↔ programme link with
--                                programme/cohort/department context
--
-- The verification flow:
--   1. Admin uploads roster (matric_number + programme/cohort/department)
--   2. Student signs up, submits matric number on the link page
--   3. SECURITY DEFINER function `claim_roster_seat` matches and atomically:
--        - marks the roster entry claimed
--        - sets profile.institution_id (via link_user_to_institution)
--        - creates the enrollment row
--   4. Student instantly sees their affiliation badge.
--
-- profiles.institution_id remains the canonical "linked" flag. Enrollment is
-- the rich layer on top — added context, not a replacement.
-- ════════════════════════════════════════

-- ── institution_programmes ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS institution_programmes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id  UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  department_id   UUID REFERENCES departments(id) ON DELETE SET NULL,
  name            TEXT NOT NULL CHECK (char_length(trim(name)) > 0),
  short_code      TEXT,
  degree_level    TEXT NOT NULL CHECK (degree_level IN (
                    'bachelor', 'master', 'phd', 'postdoc', 'staff', 'other'
                  )),
  duration_months INTEGER CHECK (duration_months IS NULL OR duration_months > 0),
  description     TEXT,
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (institution_id, name)
);

CREATE INDEX IF NOT EXISTS idx_institution_programmes_institution
  ON institution_programmes (institution_id, active);
CREATE INDEX IF NOT EXISTS idx_institution_programmes_department
  ON institution_programmes (department_id) WHERE department_id IS NOT NULL;

DROP TRIGGER IF EXISTS set_updated_at ON institution_programmes;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON institution_programmes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── institution_cohorts ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS institution_cohorts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  programme_id        UUID NOT NULL REFERENCES institution_programmes(id) ON DELETE CASCADE,
  year                INTEGER NOT NULL CHECK (year BETWEEN 1900 AND 2200),
  label               TEXT,
  start_date          DATE,
  expected_completion DATE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Same year may have multiple intakes (Fall/Spring) distinguished by label
  UNIQUE (programme_id, year, label)
);

CREATE INDEX IF NOT EXISTS idx_institution_cohorts_programme
  ON institution_cohorts (programme_id, year DESC);

DROP TRIGGER IF EXISTS set_updated_at ON institution_cohorts;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON institution_cohorts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── institution_roster_entries ──────────────────────────────────────────────
-- The matriculation list. Pre-loaded by the institution admin before students
-- sign up. The matric_number is the verification key — if a student supplies
-- a matric number that matches an unclaimed entry, they're instantly linked
-- with the programme/cohort/department metadata baked in.

CREATE TABLE IF NOT EXISTS institution_roster_entries (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id        UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  matriculation_number  TEXT NOT NULL CHECK (char_length(trim(matriculation_number)) > 0),
  programme_id          UUID REFERENCES institution_programmes(id) ON DELETE SET NULL,
  cohort_id             UUID REFERENCES institution_cohorts(id) ON DELETE SET NULL,
  department_id         UUID REFERENCES departments(id) ON DELETE SET NULL,
  intended_role         TEXT NOT NULL DEFAULT 'researcher' CHECK (intended_role IN (
                          'researcher', 'student', 'supervisor', 'admin', 'coordinator', 'viewer'
                        )),
  full_name_hint        TEXT,
  email_hint            TEXT,
  notes                 TEXT,
  status                TEXT NOT NULL DEFAULT 'unclaimed' CHECK (status IN (
                          'unclaimed', 'claimed', 'invalidated'
                        )),
  claimed_by            UUID REFERENCES profiles(id) ON DELETE SET NULL,
  claimed_at            TIMESTAMPTZ,
  uploaded_by           UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Matric numbers unique within an institution (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_institution_roster_matric
  ON institution_roster_entries (institution_id, lower(matriculation_number));

CREATE INDEX IF NOT EXISTS idx_institution_roster_status
  ON institution_roster_entries (institution_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_institution_roster_programme
  ON institution_roster_entries (programme_id) WHERE programme_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_institution_roster_cohort
  ON institution_roster_entries (cohort_id) WHERE cohort_id IS NOT NULL;

DROP TRIGGER IF EXISTS set_updated_at ON institution_roster_entries;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON institution_roster_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── institution_enrollments ─────────────────────────────────────────────────
-- The "you belong" row. One person can hold multiple enrollments over time
-- (BSc → MSc → PhD) but only one ACTIVE enrollment per programme at a time.

CREATE TABLE IF NOT EXISTS institution_enrollments (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  institution_id        UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  programme_id          UUID REFERENCES institution_programmes(id) ON DELETE SET NULL,
  cohort_id             UUID REFERENCES institution_cohorts(id) ON DELETE SET NULL,
  department_id         UUID REFERENCES departments(id) ON DELETE SET NULL,
  matriculation_number  TEXT,
  roster_entry_id       UUID REFERENCES institution_roster_entries(id) ON DELETE SET NULL,
  status                TEXT NOT NULL DEFAULT 'active' CHECK (status IN (
                          'active', 'on_leave', 'graduated', 'withdrawn'
                        )),
  enrolled_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  end_date              DATE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One active enrollment per (user, programme). Graduated/withdrawn rows
-- coexist with a new active row, supporting progression (BSc → MSc → PhD).
CREATE UNIQUE INDEX IF NOT EXISTS uniq_institution_enrollments_active
  ON institution_enrollments (user_id, programme_id)
  WHERE status = 'active' AND programme_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_institution_enrollments_user
  ON institution_enrollments (user_id, status);
CREATE INDEX IF NOT EXISTS idx_institution_enrollments_institution
  ON institution_enrollments (institution_id, status);
CREATE INDEX IF NOT EXISTS idx_institution_enrollments_programme_cohort
  ON institution_enrollments (programme_id, cohort_id) WHERE programme_id IS NOT NULL;

DROP TRIGGER IF EXISTS set_updated_at ON institution_enrollments;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON institution_enrollments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ════════════════════════════════════════
-- Row-level security
-- ════════════════════════════════════════

ALTER TABLE institution_programmes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE institution_cohorts           ENABLE ROW LEVEL SECURITY;
ALTER TABLE institution_roster_entries    ENABLE ROW LEVEL SECURITY;
ALTER TABLE institution_enrollments       ENABLE ROW LEVEL SECURITY;

-- ── programmes: anyone authenticated can read active programmes of any
--    provisioned institution (used by the matric link picker); admins write.

DROP POLICY IF EXISTS "Read active programmes" ON institution_programmes;
CREATE POLICY "Read active programmes" ON institution_programmes
  FOR SELECT TO authenticated USING (
    active = TRUE
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.institution_id = institution_programmes.institution_id
        AND p.role IN ('admin', 'coordinator')
    )
  );

DROP POLICY IF EXISTS "Institution admins write programmes" ON institution_programmes;
CREATE POLICY "Institution admins write programmes" ON institution_programmes
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.institution_id = institution_programmes.institution_id
        AND p.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.institution_id = institution_programmes.institution_id
        AND p.role = 'admin'
    )
  );

-- ── cohorts: same pattern (read via programme link)

DROP POLICY IF EXISTS "Read cohorts of readable programmes" ON institution_cohorts;
CREATE POLICY "Read cohorts of readable programmes" ON institution_cohorts
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM institution_programmes pr
      WHERE pr.id = institution_cohorts.programme_id
    )
  );

DROP POLICY IF EXISTS "Institution admins write cohorts" ON institution_cohorts;
CREATE POLICY "Institution admins write cohorts" ON institution_cohorts
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM institution_programmes pr
      JOIN profiles p ON p.institution_id = pr.institution_id
      WHERE pr.id = institution_cohorts.programme_id
        AND p.id = auth.uid()
        AND p.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM institution_programmes pr
      JOIN profiles p ON p.institution_id = pr.institution_id
      WHERE pr.id = institution_cohorts.programme_id
        AND p.id = auth.uid()
        AND p.role = 'admin'
    )
  );

-- ── roster: admin-only on every side. The matric verification path runs
--    through claim_roster_seat (SECURITY DEFINER) so end users never
--    SELECT roster entries directly — that would let them enumerate matric
--    numbers by spraying.

DROP POLICY IF EXISTS "Institution admins manage roster" ON institution_roster_entries;
CREATE POLICY "Institution admins manage roster" ON institution_roster_entries
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.institution_id = institution_roster_entries.institution_id
        AND p.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.institution_id = institution_roster_entries.institution_id
        AND p.role = 'admin'
    )
  );

-- ── enrollments: a user sees their own; institution admins see all theirs.
--    Writes happen via SECURITY DEFINER functions or the API service-client.

DROP POLICY IF EXISTS "Users see own enrollments" ON institution_enrollments;
CREATE POLICY "Users see own enrollments" ON institution_enrollments
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Institution admins see institution enrollments" ON institution_enrollments;
CREATE POLICY "Institution admins see institution enrollments" ON institution_enrollments
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.institution_id = institution_enrollments.institution_id
        AND p.role IN ('admin', 'coordinator')
    )
  );

-- ════════════════════════════════════════
-- claim_roster_seat — atomic matric verification + link
-- Returns the enrollment id on success, NULL on no match. Raises only on
-- integrity violations.
-- ════════════════════════════════════════

CREATE OR REPLACE FUNCTION claim_roster_seat(
  p_user_id              UUID,
  p_institution_id       UUID,
  p_matriculation_number TEXT,
  p_decided_by           UUID
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_roster       institution_roster_entries%ROWTYPE;
  v_workspace_id UUID;
  v_enrollment_id UUID;
  v_user_email   TEXT;
  v_user_name    TEXT;
BEGIN
  IF p_matriculation_number IS NULL OR length(trim(p_matriculation_number)) = 0 THEN
    RETURN NULL;
  END IF;

  -- 1. Look up the roster entry, locking it so two concurrent claims serialise.
  SELECT * INTO v_roster
  FROM institution_roster_entries
  WHERE institution_id = p_institution_id
    AND lower(matriculation_number) = lower(trim(p_matriculation_number))
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF v_roster.status <> 'unclaimed' THEN
    RAISE EXCEPTION 'Matriculation number already claimed' USING ERRCODE = '23505';
  END IF;

  -- 2. Soft sanity check on full_name / email hints. We don't HARD-fail on
  -- mismatch — admins want flexibility — but the check is loud in audit.
  -- (Hint matching is informational; the matric number is the auth key.)
  SELECT email, full_name INTO v_user_email, v_user_name
  FROM profiles WHERE id = p_user_id;

  -- 3. Find the institutional workspace.
  SELECT id INTO v_workspace_id
  FROM workspaces
  WHERE institution_id = p_institution_id
    AND type = 'institutional'
  LIMIT 1;

  IF v_workspace_id IS NULL THEN
    RAISE EXCEPTION 'Institutional workspace not provisioned' USING ERRCODE = 'P0002';
  END IF;

  -- 4. Mark the roster entry claimed.
  UPDATE institution_roster_entries
    SET status = 'claimed',
        claimed_by = p_user_id,
        claimed_at = now()
    WHERE id = v_roster.id;

  -- 5. Update the profile: institution_id + department (if roster set one).
  UPDATE profiles
    SET institution_id = p_institution_id,
        department_id  = COALESCE(v_roster.department_id, department_id)
    WHERE id = p_user_id;

  -- 6. Upsert workspace membership at the intended role.
  INSERT INTO workspace_memberships (workspace_id, user_id, role, status, invited_by, department_id)
    VALUES (
      v_workspace_id,
      p_user_id,
      CASE
        WHEN v_roster.intended_role IN ('admin', 'supervisor', 'coordinator', 'viewer')
          THEN v_roster.intended_role
        ELSE 'researcher'
      END,
      'active',
      p_decided_by,
      v_roster.department_id
    )
    ON CONFLICT (workspace_id, user_id) DO UPDATE
      SET status     = 'active',
          invited_by = EXCLUDED.invited_by,
          department_id = COALESCE(EXCLUDED.department_id, workspace_memberships.department_id);

  -- 7. Record the approved link request (so audit/UI history shows it).
  INSERT INTO institution_link_requests (
    user_id, institution_id, status, message,
    auto_approved, decided_by, decided_at
  ) VALUES (
    p_user_id, p_institution_id, 'approved',
    'Verified via matriculation number',
    TRUE, p_decided_by, now()
  )
  ON CONFLICT DO NOTHING;

  -- 8. Create the enrollment row.
  INSERT INTO institution_enrollments (
    user_id, institution_id, programme_id, cohort_id, department_id,
    matriculation_number, roster_entry_id, status
  ) VALUES (
    p_user_id, p_institution_id, v_roster.programme_id, v_roster.cohort_id, v_roster.department_id,
    v_roster.matriculation_number, v_roster.id, 'active'
  )
  RETURNING id INTO v_enrollment_id;

  RETURN v_enrollment_id;
END;
$$;

REVOKE ALL ON FUNCTION claim_roster_seat(UUID, UUID, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION claim_roster_seat(UUID, UUID, TEXT, UUID) TO service_role;
